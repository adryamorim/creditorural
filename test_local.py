# Teste da Azure Function localmente
# Execute: pip install -r requirements.txt && func start

# Exemplo de teste via curl:
# curl "http://localhost:7071/api/car-analysis/MS-5006903-20653795E9D942A39F0AC0227622148F"

# Ou via Python:
import requests

url = "http://localhost:7071/api/car-analysis/MS-5006903-20653795E9D942A39F0AC0227622148F"
response = requests.get(url)

if response.status_code == 200:
    data = response.json()
    print("CAR Área:", data.get("car_area"))
    print("PRODES Área:", data.get("prodes_area"))
    print("Percentual:", data.get("prodes_percentage"))
    print("Mensagem:", data.get("compliance_message"))
else:
    print("Erro:", response.status_code, response.text)