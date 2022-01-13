import os
from company_service_client import Client
from company_service_client.api.company import company_controller_add_many
from company_service_client.api.company import company_controller_companies
from company_service_client.models import CreateCompanyDto

production = os.environ.get('PRODUCTION', False)
url = os.environ.get('API_URL', 'http://127.0.0.1:3000')

client = Client(
  base_url=url,
  timeout=30.0,
  verify_ssl=production)

# TODO: Insert scraping code here, and use the call outlined below to insert companies
company_controller_add_many.sync_detailed(client=client, json_body=
  [
    CreateCompanyDto(company_name='some company', country='DK', company_id='121212'),
    CreateCompanyDto(company_name='some other company', country='DK', company_id='454545')
  ]
)

print(f'Added companies:')
print(company_controller_companies.sync_detailed(client=client).content)
