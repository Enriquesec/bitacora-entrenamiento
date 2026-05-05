"""
Corre este script UNA SOLA VEZ en tu computadora para autorizar el acceso
a Google Drive y generar el token que usará GitHub Actions.

Pasos:
  1. Instala las dependencias:
       pip install google-auth-oauthlib google-api-python-client

  2. Descarga tu credentials.json desde Google Cloud Console:
       APIs & Services → Credentials → tu OAuth Client ID → Download JSON
     Guárdalo en la misma carpeta que este script.

  3. Corre el script:
       python scripts/generar_token_drive.py

     Abrirá el navegador para que autorices con tu cuenta de Google.

  4. Se generará token.json en la carpeta actual.
     Copia TODO su contenido y guárdalo en GitHub:
       Settings → Secrets and variables → Actions → New secret
       Nombre: GOOGLE_CREDENTIALS
       Valor: (pega el contenido de token.json)

  5. Puedes borrar credentials.json y token.json de tu computadora.
"""

import json
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/drive.file']

flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
# Abre un servidor local temporal; el navegador redirige ahí tras autorizar
creds = flow.run_local_server(port=0)

token_data = json.loads(creds.to_json())
with open('token.json', 'w') as f:
    json.dump(token_data, f, indent=2)

print()
print('✅ token.json generado correctamente.')
print()
print('Copia el contenido de token.json como secret GOOGLE_CREDENTIALS en GitHub:')
print()
print(json.dumps(token_data, indent=2))
