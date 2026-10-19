import test_app


class NearbyTests(test_app.ApplicationTests):
    def test_radius_uses_unrounded_distance(self):
        from math import degrees
        longitude=degrees(4.00001/6371.0088)
        saved=self.client.put('/owner/mess-profile',headers=self.owner,
            json={'name':'Outside four','latitude':0,'longitude':longitude})
        self.assertEqual(saved.status_code,200,saved.text)
        outside=self.client.get('/public/messes?latitude=0&longitude=0&radius_km=4')
        self.assertEqual(outside.json(),[])
        self.assertEqual(len(self.client.get('/public/messes?latitude=0&longitude=0&radius_km=10').json()),1)

    def test_coordinates_validate_preserve_and_clear(self):
        saved = self.client.put('/owner/mess-profile', headers=self.owner,
                                json={'name': 'Near Kitchen', 'latitude': 0, 'longitude': 0})
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json().get('latitude'), 0)
        self.assertEqual(self.client.put('/owner/mess-profile', headers=self.owner,
                         json={'name': 'Renamed'}).json()['longitude'], 0)
        for payload in ({'latitude': 91, 'longitude': 0}, {'latitude': 1},
                        {'latitude': None, 'longitude': 1}):
            self.assertEqual(self.client.put('/owner/mess-profile', headers=self.owner,
                                            json=payload).status_code, 422)
        cleared = self.client.put('/owner/mess-profile', headers=self.owner,
                                  json={'latitude': None, 'longitude': None})
        self.assertIsNone(cleared.json()['latitude'])

    def test_radius_sort_unknown_and_default(self):
        self.client.put('/owner/mess-profile', headers=self.owner,
                        json={'name': 'Near', 'latitude': 0, 'longitude': .02})
        farther, _ = self.account('9876543225', 'owner')
        self.client.put('/owner/mess-profile', headers=farther,
                        json={'name': 'Far', 'latitude': 0, 'longitude': .06})
        self.account('9876543226', 'owner')
        all_rows = self.client.get('/public/messes').json()
        self.assertEqual(len(all_rows), 3)
        near = self.client.get('/public/messes?latitude=0&longitude=0&radius_km=4').json()
        self.assertEqual([r['name'] for r in near], ['Near'])
        self.assertAlmostEqual(near[0]['distance_km'], 2.2239, places=3)
        wide = self.client.get('/public/messes?latitude=0&longitude=0&radius_km=10').json()
        self.assertEqual([r['name'] for r in wide], ['Near', 'Far'])
        self.assertEqual(near[0]['join_token'], all_rows[0]['join_token'])
        for query in ('radius_km=4', 'latitude=0', 'latitude=0&longitude=181',
                      'latitude=0&longitude=0&radius_km=7'):
            self.assertEqual(self.client.get('/public/messes?' + query).status_code, 422)
