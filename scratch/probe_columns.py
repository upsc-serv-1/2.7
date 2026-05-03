
import requests

SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

res = requests.get(f"{SUPABASE_URL}/rest/v1/questions?limit=1", headers=headers)
if res.status_code == 200 and len(res.json()) > 0:
    print("Columns:", list(res.json()[0].keys()))
else:
    print("Error or no data:", res.status_code, res.text)
