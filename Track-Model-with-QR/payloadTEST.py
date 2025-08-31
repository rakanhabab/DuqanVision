from api import *
import requests

payload = {
    "user_id": "4a2c51a8-120a-40e2-a792-d49dd7f274ab",
    "items": [
        {"name": "kit_kat", "quantity": 3},
        {"name": "oreos", "quantity": 1},
        {"name": "protein_bar", "quantity": 1}
    ]
}

resp = requests.post("http://127.0.0.1:8000/invoices", json=payload)
print(resp.status_code, resp.text)
