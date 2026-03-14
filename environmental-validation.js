/*
  Módulo de Validação Ambiental (Frontend)
  Responsável por:
    - interface de consulta por código do CAR
    - chamada da API Python (/api/car-analysis/{car_code})
    - desenho das camadas CAR + PRODES no Leaflet
    - retorno de resultados para a página principal

  Uso:
    EnvironmentalValidation.init({ map, inputId, buttonId, statusId });
    // ou apenas:
    EnvironmentalValidation.run(carCode);
*/

const EnvironmentalValidation = (function () {
  let mapInstance = null;
  let layerControl = null;
  let carLayer = null;
  let prodesLayer = null;
  let statusEl = null;
  let summaryContainer = null;
  let carAreaEl = null;
  let prodesAreaEl = null;
  let prodesPercentEl = null;
  let complianceMessageEl = null;

  const DEFAULT_LAYER_OPTS = {
    CAR: {
      color: '#008000',
      weight: 2,
      opacity: 1,
      fillColor: '#008000',
      fillOpacity: 0.2
    },
    PRODES: {
      color: '#ff0000',
      weight: 1,
      opacity: 1,
      fillColor: '#ff0000',
      fillOpacity: 0.6
    }
  };

  function setStatus(text, type = 'info') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'text-sm';

    if (type === 'error') {
      statusEl.classList.add('text-red-600');
      statusEl.classList.remove('text-green-600', 'text-blue-600');
    } else if (type === 'success') {
      statusEl.classList.add('text-green-600');
      statusEl.classList.remove('text-red-600', 'text-blue-600');
    } else {
      statusEl.classList.add('text-blue-600');
      statusEl.classList.remove('text-red-600', 'text-green-600');
    }
  }

  function updateSummary(result) {
    if (!summaryContainer) return;

    if (!result || !result.carCode) {
      summaryContainer.classList.add('hidden');
      return;
    }

    carAreaEl.textContent = `${result.carArea?.toFixed(2) ?? 0} ha`;
    prodesAreaEl.textContent = `${result.prodesArea?.toFixed(2) ?? 0} ha`;
    prodesPercentEl.textContent = `${result.prodesPercent?.toFixed(2) ?? 0}%`;
    complianceMessageEl.textContent = result.complianceMessage || '—';

    summaryContainer.classList.remove('hidden');
  }

  function clearLayers() {
    if (carLayer && mapInstance) {
      mapInstance.removeLayer(carLayer);
      carLayer = null;
    }
    if (prodesLayer && mapInstance) {
      mapInstance.removeLayer(prodesLayer);
      prodesLayer = null;
    }
    if (layerControl && mapInstance) {
      mapInstance.removeControl(layerControl);
      layerControl = null;
    }
  }

  function drawCarLayer(geojson) {
    if (!mapInstance) throw new Error('Map instance não configurada. Chame EnvironmentalValidation.init({ map })');

    if (carLayer) {
      mapInstance.removeLayer(carLayer);
      carLayer = null;
    }

    carLayer = L.geoJSON(geojson, {
      style: DEFAULT_LAYER_OPTS.CAR
    }).addTo(mapInstance);

    if (carLayer && carLayer.getBounds && !carLayer.getBounds().isValid()) {
      // fallback: nenhum bounds válido
    } else if (carLayer && carLayer.getBounds) {
      mapInstance.fitBounds(carLayer.getBounds(), { padding: [20, 20] });
    }

    return carLayer;
  }

  function drawProdesLayer(geojson) {
    if (!mapInstance) throw new Error('Map instance não configurada. Chame EnvironmentalValidation.init({ map })');

    if (prodesLayer) {
      mapInstance.removeLayer(prodesLayer);
      prodesLayer = null;
    }

    prodesLayer = L.geoJSON(geojson, {
      style: DEFAULT_LAYER_OPTS.PRODES
    }).addTo(mapInstance);

    return prodesLayer;
  }

  function buildLayerControl() {
    if (!mapInstance) return;

    if (layerControl) {
      mapInstance.removeControl(layerControl);
      layerControl = null;
    }

    const overlays = {};
    if (carLayer) overlays['CAR'] = carLayer;
    if (prodesLayer) overlays['PRODES'] = prodesLayer;

    if (Object.keys(overlays).length === 0) return;

    layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(mapInstance);
  }

  async function fetchCarAnalysis(carCode) {
    if (!carCode || !carCode.trim()) {
      throw new Error('Código do CAR é obrigatório');
    }

    const sanitized = encodeURIComponent(carCode.trim());

    // URL da Azure Function (ajuste conforme seu deployment)
    // Exemplo: https://your-function-app.azurewebsites.net/api/car-analysis/{car_code}
    const azureUrl = `https://your-function-app.azurewebsites.net/api/car-analysis/${sanitized}`;

    // Fallback para local (desenvolvimento)
    const localUrl = `http://127.0.0.1:8000/api/car-analysis/${sanitized}`;

    async function fetchJson(url) {
      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Falha na API (${resp.status}): ${text}`);
      }
      return resp.json();
    }

    try {
      // Tenta primeiro a Azure Function
      return await fetchJson(azureUrl);
    } catch (err) {
      // Fallback para local (se estiver desenvolvendo)
      if (typeof err === 'object' && err.name === 'TypeError') {
        return await fetchJson(localUrl);
      }
      throw err;
    }
  }

  async function run(carCode) {
    if (!mapInstance) {
      throw new Error('Map instance não configurada. Chame EnvironmentalValidation.init({ map }) antes de run().');
    }

    setStatus('Buscando dados do CAR...', 'info');
    clearLayers();
    updateSummary(null);

    const result = {
      carCode: carCode,
      carArea: 0,
      prodesArea: 0,
      prodesPercent: 0,
      complianceMessage: ''
    };

    try {
      const response = await fetchCarAnalysis(carCode);

      // Desenhar CAR
      if (response.car_geometry) {
        drawCarLayer(response.car_geometry);
      }

      // Desenhar PRODES
      if (response.prodes_geometry) {
        drawProdesLayer(response.prodes_geometry);
      }

      buildLayerControl();

      // Calcular área (confirmação com Turf.js)
      if (response.car_geometry) {
        try {
          const carArea = turf.area(response.car_geometry) / 10000;
          result.carArea = carArea;
        } catch (_) {
          result.carArea = response.car_area || 0;
        }
      }

      if (response.prodes_geometry) {
        try {
          const prodesArea = turf.area(response.prodes_geometry) / 10000;
          result.prodesArea = prodesArea;
        } catch (_) {
          result.prodesArea = response.prodes_area || 0;
        }
      }

      result.prodesPercent = typeof response.prodes_percentage === 'number' ? response.prodes_percentage : 0;
      result.complianceMessage = response.compliance_message || '';

      setStatus('Consulta concluída', 'success');
      updateSummary(result);
      return result;
    } catch (err) {
      setStatus(`Erro: ${err.message}. Verifique se o servidor backend está em execução (uvicorn).`, 'error');
      updateSummary(null);
      throw err;
    }
  }

  function init({ map, inputId = 'car-code-input', buttonId = 'search-car-btn', statusId = 'car-search-status' } = {}) {
    if (!map) {
      throw new Error('Parametro map é obrigatório em EnvironmentalValidation.init({ map })');
    }

    mapInstance = map;
    statusEl = document.getElementById(statusId);
    summaryContainer = document.getElementById('environmental-summary');
    carAreaEl = document.getElementById('env-car-area');
    prodesAreaEl = document.getElementById('env-prodes-area');
    prodesPercentEl = document.getElementById('env-prodes-percent');
    complianceMessageEl = document.getElementById('env-compliance-message');

    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);

    if (!input || !button) {
      console.warn('Input ou botão não encontrados. Certifique-se de que existem elementos com os IDs especificados.');
      return;
    }

    button.addEventListener('click', async () => {
      const carCode = input.value.trim();
      if (!carCode) {
        setStatus('Informe o código do CAR.', 'error');
        return;
      }

      try {
        await run(carCode);
      } catch (error) {
        console.error('Erro durante validação ambiental:', error);
      }
    });

    updateSummary(null);
  }

  return {
    init,
    run,
    fetchCarAnalysis,
    drawCarLayer,
    drawProdesLayer,
    buildLayerControl
  };
})();

// Expondo globalmente (caso não exista)
if (typeof window !== 'undefined' && !window.EnvironmentalValidation) {
  window.EnvironmentalValidation = EnvironmentalValidation;
}
