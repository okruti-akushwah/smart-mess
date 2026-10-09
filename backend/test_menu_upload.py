import base64
import tempfile
from pathlib import Path
from unittest.mock import patch
import test_app
from app import menu_images

class MenuUploadTests(test_app.ApplicationTests):
    def test_upload_save_and_validation(self):
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        with tempfile.TemporaryDirectory() as folder, patch.object(menu_images, 'IMAGE_DIR', Path(folder)), patch('app.routes.image_routes.IMAGE_DIR', Path(folder)):
            response = self.client.post('/owner/menu-images/upload', headers=self.owner, files={'file':('../../photo.png', png, 'image/png')})
            self.assertEqual(response.status_code, 200, response.text)
            url = response.json()['image_url']
            meal = self.meal(menu_description='Daal, roti', image_url=url)
            self.assertEqual(meal['image_url'], url)
            self.assertEqual(self.client.get('/meals/upcoming', headers=self.customer).json()[0]['image_url'], url)
            self.assertEqual(self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner, json={'image_url':None}).status_code, 200)
            self.assertEqual(self.client.post('/owner/menu-images/upload', headers=self.customer, files={'file':('p.png',png,'image/png')}).status_code,403)
            self.assertEqual(self.client.post('/owner/menu-images/upload', headers=self.owner, files={'file':('p.png',b'<svg/>','image/png')}).status_code,422)
            self.assertEqual(self.client.post('/owner/menu-images/upload', headers=self.owner, files={'file':('p.png',b'x'*(5*1024*1024+1),'image/png')}).status_code,413)
            from fastapi import HTTPException
            with self.assertRaises(HTTPException):
                menu_images.validate_image('Daal', url, 99999)
