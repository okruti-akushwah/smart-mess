from unittest.mock import patch
from test_app import ApplicationTests
from app import models
from app.routes import translation_routes as translations

class TranslationTests(ApplicationTests):
    def setUp(self):
        super().setUp()
        translations._CACHE.clear()
        translations._LIMITS.clear()

    def request(self, kind, identifier, field, language='hi'):
        return self.client.post('/translations',json={'language':language,'records':[{'kind':kind,'id':identifier,'field':field}]})

    def test_missing_provider_falls_back_without_writing_source(self):
        meal=self.meal(menu_description='Dal and roti')
        with patch.dict('os.environ',{'GOOGLE_TRANSLATE_API_KEY':'','TRANSLATION_REDIS_REST_URL':''}):
            response=self.request('meal',meal['id'],'menu_description')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['translations'][0]['text'],'Dal and roti')
        self.assertFalse(response.json()['translations'][0]['translated'])
        with self.Session() as db:self.assertEqual(db.get(models.Meal,meal['id']).menu_description,'Dal and roti')

    def test_translation_cache_and_source_invalidation(self):
        meal=self.meal(menu_description='Dal and roti')
        with patch.object(translations,'translate_sources',return_value=['दाल और रोटी']) as provider:
            for _ in range(2):
                response=self.request('meal',meal['id'],'menu_description')
                self.assertEqual(response.json()['translations'][0]['text'],'दाल और रोटी')
            self.assertEqual(provider.call_count,1)
            with self.Session() as db:
                db.get(models.Meal,meal['id']).menu_description='Rice and roti';db.commit()
            self.request('meal',meal['id'],'menu_description')
            self.assertEqual(provider.call_count,2)

    def test_private_fields_and_arbitrary_text_are_rejected(self):
        self.assertEqual(self.request('mess',self.owner_id,'address').status_code,422)
        self.assertEqual(self.request('mess',self.owner_id,'phone').status_code,422)
        self.assertEqual(self.client.post('/translations',json={'language':'hi','records':[{'kind':'user','id':self.customer_id,'field':'name'}]}).status_code,422)
        self.assertEqual(self.request('meal',99999,'menu_description').status_code,404)

    def test_english_and_owner_hindi_override_do_not_call_provider(self):
        self.client.put('/owner/mess-profile',headers=self.owner,json={'name':'Brand','about':'Fresh daily','about_hi':'रोज़ ताज़ा भोजन'})
        with patch.object(translations,'translate_sources') as provider:
            self.assertEqual(self.request('mess',self.owner_id,'about').json()['translations'][0]['text'],'रोज़ ताज़ा भोजन')
            self.assertEqual(self.request('mess',self.owner_id,'about','en').json()['translations'][0]['text'],'Fresh daily')
            provider.assert_not_called()

    def test_protected_names_numbers_and_provider_failure(self):
        self.client.put('/owner/mess-profile',headers=self.owner,json={'name':'Sharma Tiffin Centre'})
        meal=self.meal(menu_description='Sharma Tiffin Centre lunch for 120')
        def translated(masked):
            self.assertNotIn('Sharma Tiffin Centre',masked[0])
            self.assertNotIn('120',masked[0])
            return [masked[0].replace('lunch for','दोपहर का भोजन')]
        with patch.object(translations,'translate_sources',side_effect=translated):
            text=self.request('meal',meal['id'],'menu_description').json()['translations'][0]['text']
            self.assertIn('Sharma Tiffin Centre',text);self.assertIn('120',text)
        translations._CACHE.clear()
        import httpx
        with patch.object(translations,'translate_sources',side_effect=httpx.ConnectError('provider unavailable')):
            response=self.request('meal',meal['id'],'menu_description')
            self.assertFalse(response.json()['translations'][0]['translated'])
            self.assertEqual(response.json()['translations'][0]['text'],meal['menu_description'])
