import azure.functions as func
import logging
import geopandas as gpd
from shapely.geometry import shape
import json

# Importações agrobr (dependendo da versão, os nomes dos módulos podem variar)
try:
    from agrobr.sicar import SICAR
    from agrobr.prodes import Prodes
except Exception as e:
    SICAR = None
    Prodes = None

app = func.FunctionApp()

def _ensure_agrobr_available():
    if SICAR is None or Prodes is None:
        raise RuntimeError(
            "agrobr não está disponível. Verifique se o pacote está instalado e se os imports estão corretos."
        )

def _gdf_to_geojson_feature_collection(gdf: gpd.GeoDataFrame):
    """Converte GeoDataFrame para GeoJSON FeatureCollection (dicionário)."""
    if gdf is None or gdf.empty:
        return {"type": "FeatureCollection", "features": []}
    return json.loads(gdf.to_json())

def _calculate_area_ha(gdf: gpd.GeoDataFrame) -> float:
    """Calcula área em hectares usando projeção métrica adequada."""
    if gdf is None or gdf.empty:
        return 0.0

    # 1) Garantir CRS em WGS84
    gdf = gdf.to_crs(epsg=4326)
    # 2) Projetar para CRS métrico (Brazillian Albers) para cálculo de área
    try:
        gdf_m = gdf.to_crs(epsg=5880)
    except Exception:
        # fallback para Web Mercator se não houver a projeção
        gdf_m = gdf.to_crs(epsg=3857)

    area_m2 = gdf_m.geometry.area.sum()
    return float(area_m2 / 10000.0)

@app.route(route="car-analysis/{car_code}", auth_level=func.AuthLevel.ANONYMOUS)
def car_analysis(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processando requisição para análise de CAR.')

    car_code = req.route_params.get('car_code')
    if not car_code:
        return func.HttpResponse(
            "Código do CAR é obrigatório",
            status_code=400
        )

    _ensure_agrobr_available()

    # 1) Buscar CAR do SICAR
    sicar = SICAR()
    try:
        car_gdf = sicar.get_imovel(car_code)
    except Exception as e:
        logging.error(f"Falha ao consultar SICAR: {e}")
        return func.HttpResponse(
            f"Falha ao consultar SICAR: {e}",
            status_code=500
        )

    if car_gdf is None or car_gdf.empty:
        return func.HttpResponse(
            f"CAR {car_code} não encontrado no SICAR",
            status_code=404
        )

    # 2) Buscar PRODES (2019-2025)
    prodes = Prodes()
    try:
        prodes_gdf = prodes.get_prodes(ano_min=2019, ano_max=2025)
    except Exception as e:
        logging.error(f"Falha ao consultar PRODES: {e}")
        return func.HttpResponse(
            f"Falha ao consultar PRODES: {e}",
            status_code=500
        )

    if prodes_gdf is None or prodes_gdf.empty:
        prodes_gdf = gpd.GeoDataFrame(geometry=[])

    # 3) Filtrar PRODES apenas pelo bounding box do CAR para reduzir carga
    try:
        car_bounds = car_gdf.total_bounds  # [minx, miny, maxx, maxy]
        x_min, y_min, x_max, y_max = car_bounds
        prodes_gdf = prodes_gdf.cx[x_min:x_max, y_min:y_max]
    except Exception:
        # Se falhar, mantém todos
        pass

    # 4) Calcular interseção geográfica entre CAR e PRODES
    try:
        # Garante mesma CRS
        prodes_gdf = prodes_gdf.to_crs(car_gdf.crs)
        intersection_gdf = gpd.overlay(car_gdf, prodes_gdf, how='intersection')
    except Exception:
        intersection_gdf = gpd.GeoDataFrame(geometry=[])

    # 5) Cálculos de áreas
    car_area_ha = _calculate_area_ha(car_gdf)
    prodes_area_ha = _calculate_area_ha(intersection_gdf)

    prodes_percent = 0.0
    if car_area_ha > 0 and prodes_area_ha > 0:
        prodes_percent = (prodes_area_ha / car_area_ha) * 100.0

    compliance_message = (
        "Não foram identificados polígonos de desmatamento PRODES entre 2019 e 2025 dentro do CAR analisado. Situação indicativa de conformidade."
        if prodes_area_ha == 0
        else "Foram identificados polígonos de desmatamento PRODES dentro do CAR analisado."
    )

    response_data = {
        "car_geometry": _gdf_to_geojson_feature_collection(car_gdf),
        "car_area": car_area_ha,
        "prodes_geometry": _gdf_to_geojson_feature_collection(intersection_gdf),
        "prodes_area": prodes_area_ha,
        "prodes_percentage": prodes_percent,
        "compliance_message": compliance_message,
    }

    return func.HttpResponse(
        json.dumps(response_data),
        mimetype="application/json",
        status_code=200
    )