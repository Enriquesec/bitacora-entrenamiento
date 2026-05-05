import os
import json
import csv
import requests
from datetime import datetime
from google.oauth2 import service_account, credentials as oauth2_credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

NOTION_TOKEN = os.environ['NOTION_TOKEN']
DATABASE_ID  = os.environ['NOTION_DATABASE_ID']
SCOPES       = ['https://www.googleapis.com/auth/drive.file']


def build_credentials():
    data = json.loads(os.environ['GOOGLE_CREDENTIALS'])
    if data.get('type') == 'service_account':
        return service_account.Credentials.from_service_account_info(data, scopes=SCOPES)
    # OAuth2 token generado con generar_token_drive.py
    return oauth2_credentials.Credentials(
        token=data.get('token'),
        refresh_token=data['refresh_token'],
        token_uri=data.get('token_uri', 'https://oauth2.googleapis.com/token'),
        client_id=data['client_id'],
        client_secret=data['client_secret'],
    )


def get_notion_records():
    url     = f'https://api.notion.com/v1/databases/{DATABASE_ID}/query'
    headers = {'Authorization': f'Bearer {NOTION_TOKEN}', 'Notion-Version': '2022-06-28'}
    records, cursor = [], None
    while True:
        body = {'page_size': 100}
        if cursor:
            body['start_cursor'] = cursor
        r = requests.post(url, headers=headers, json=body).json()
        records += r['results']
        if not r.get('has_more'):
            break
        cursor = r['next_cursor']
    return records


def extract(prop):
    t = prop.get('type')
    if t == 'title':     return ''.join(x['plain_text'] for x in prop['title'])
    if t == 'rich_text': return ''.join(x['plain_text'] for x in prop['rich_text'])
    if t == 'number':    return prop.get('number', '')
    if t == 'select':    return prop['select']['name'] if prop['select'] else ''
    if t == 'date':      return prop['date']['start'] if prop['date'] else ''
    if t == 'checkbox':  return 'Sí' if prop['checkbox'] else 'No'
    return ''


def save_csv(records):
    fields = [
        'Disciplina', 'Fecha', 'Día', 'Tipo', 'Detalle de Sesión', 'Hora',
        'Duración (min)', 'Distancia / Volumen', 'FC Promedio', 'FC Máxima',
        'Calorías', 'RPE', 'Carga', 'Sensación', 'Estructura / Detalle',
        'Notas', 'Sueño (h)', 'Eficiencia Sueño (%)', 'Pasos', 'Creatina',
    ]
    date_str = datetime.now().strftime('%Y-%m-%d')
    filename = f'Bitacora_Entrenamiento_{date_str}.csv'
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for record in records:
            props = record['properties']
            writer.writerow({field: extract(props[field]) for field in fields if field in props})
    print(f'📄 CSV generado: {filename} ({len(records)} registros)')
    return filename


def upload_to_drive(filename):
    folder_id = os.environ.get('GOOGLE_DRIVE_FOLDER_ID', '').strip()
    if not folder_id:
        raise ValueError(
            'GOOGLE_DRIVE_FOLDER_ID no configurado. '
            'Agrega el ID de la carpeta "Respaldo Notion" de tu Drive como secret.'
        )

    service = build('drive', 'v3', credentials=build_credentials())

    media = MediaFileUpload(filename, mimetype='text/csv')
    service.files().create(
        body={'name': filename, 'parents': [folder_id]},
        media_body=media,
        fields='id',
    ).execute()
    print(f'✅ Backup subido a Drive: {filename}')


if __name__ == '__main__':
    records  = get_notion_records()
    filename = save_csv(records)
    upload_to_drive(filename)
