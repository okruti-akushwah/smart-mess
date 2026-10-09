import test_app
from unittest.mock import patch
from fastapi import HTTPException

class ImageReliabilityTests(test_app.ApplicationTests):
    def test_menu_saves_when_image_provider_unavailable(self):
        with patch('app.menu_images.request_image', side_effect=HTTPException(429,'No image quota')) as provider:
            meal=self.meal(menu_description='Daal, Roti', image_url=None)
            self.assertIsNone(meal['image_url'])
            response=self.client.put(f"/owner/meals/{meal['id']}",headers=self.owner,json={'menu_description':'Rajma, Roti','image_url':None})
            self.assertEqual(response.status_code,200,response.text)
            provider.assert_not_called()
            self.assertEqual(response.json()['menu_description'],'Rajma, Roti')
