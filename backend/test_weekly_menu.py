from datetime import date, timedelta
import unittest

from test_app import ApplicationTests
from app import models


class _ApplicationFixture:
    setUp = ApplicationTests.setUp
    tearDown = ApplicationTests.tearDown
    account = ApplicationTests.account
    meal = ApplicationTests.meal
    plan = ApplicationTests.plan


class WeeklyMenuTests(_ApplicationFixture, unittest.TestCase):
    def save_menu(self, items):
        response = self.client.put("/owner/weekly-menu", headers=self.owner, json={"items": items})
        self.assertEqual(response.status_code, 200, response.text)
        return response

    def item(self, weekday, description, meal_type="lunch", **extra):
        return {"weekday": weekday, "meal_type": meal_type, "menu_description": description,
                "cutoff_time": "11:30", "single_price": 90, "is_complimentary": True,
                "image_url": None, **extra}

    def test_weekly_menu_creates_orderable_dates_and_owner_can_edit_pattern(self):
        weekday = (date.today().weekday() + 1) % 7
        self.save_menu([self.item(weekday, "Dal, rice and roti")])

        generated = [meal for meal in self.client.get("/meals/upcoming", headers=self.customer).json()
                     if meal["meal_type"] == "lunch" and
                     date.fromisoformat(meal["date"]).weekday() == weekday]
        self.assertEqual(len(generated), 2)
        self.assertTrue(all(meal["menu_description"] == "Dal, rice and roti" for meal in generated))
        self.assertTrue(all(meal["single_price"] == 90 for meal in generated))

        self.save_menu([self.item(weekday, "Paneer, pulao and raita")])
        refreshed = self.client.get("/owner/meals", headers=self.owner).json()
        rows = [meal for meal in refreshed if date.fromisoformat(meal["date"]).weekday() == weekday]
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(meal["menu_description"] == "Paneer, pulao and raita" for meal in rows))

    def test_manual_date_edit_stays_as_an_exception_and_activity_is_preserved(self):
        target = date.today() + timedelta(days=1)
        self.save_menu([self.item(target.weekday(), "Weekly menu")])
        meals = self.client.get("/meals/upcoming", headers=self.customer).json()
        meal = next(row for row in meals if row["date"] == target.isoformat())
        self.assertEqual(meal["menu_description"], "Weekly menu")

        # An owner edit detaches a generated meal so future refreshes retain that date-only change.
        self.client.put(f"/owner/meals/{meal['id']}", headers=self.owner,
                        json={"menu_description": "One day exception"})
        self.save_menu([self.item(target.weekday(), "Changed weekly menu")])
        meals = self.client.get("/meals/upcoming", headers=self.customer).json()
        target_meal = next(row for row in meals if row["id"] == meal["id"])
        self.assertEqual(target_meal["menu_description"], "One day exception")

        with self.Session() as db:
            protected_date = date.today() + timedelta(days=2)
            protected = models.Meal(owner_id=self.owner_id, date=protected_date, meal_type="lunch",
                                    menu_description="Meal with member activity", weekly_menu_override=False)
            db.add(protected)
            db.flush()
            protected_id = protected.id
            db.add(models.MealOrder(owner_id=self.owner_id, user_id=self.customer_id,
                                    meal_id=protected_id, status="confirmed"))
            db.commit()
        self.save_menu([self.item(target.weekday(), "Changed weekly menu"),
                        self.item((date.today() + timedelta(days=2)).weekday(), "New template")])
        protected_meal = next(row for row in self.client.get("/meals/upcoming", headers=self.customer).json()
                              if row["id"] == protected_id)
        self.assertEqual(protected_meal["menu_description"], "Meal with member activity")

    def test_weekly_menu_is_owner_only_and_public_results_are_mess_scoped(self):
        self.assertEqual(self.client.get("/owner/weekly-menu").status_code, 401)
        self.assertEqual(self.client.get("/owner/weekly-menu", headers=self.customer).status_code, 403)
        token = self.client.get("/owner/join-link", headers=self.owner).json()["token"]
        weekday = (date.today().weekday() + 1) % 7
        self.save_menu([self.item(weekday, "First kitchen menu")])
        public = self.client.get("/public/menu", params={"mess_token": token})
        self.assertEqual(public.status_code, 200, public.text)
        self.assertIn("First kitchen menu", [meal["menu_description"] for meal in public.json()])

        second_owner_body = {"name": "Second owner", "phone": "9999999999", "password": "test1234",
                             "role": "owner", "mess_name": "Second Kitchen"}
        signup = self.client.post("/auth/signup", json=second_owner_body)
        self.assertEqual(signup.status_code, 200, signup.text)
        login = self.client.post("/auth/login", json=second_owner_body)
        second_owner = {"Authorization": "Bearer " + login.json()["access_token"]}
        second_token = self.client.get("/owner/join-link", headers=second_owner).json()["token"]
        second_menu = self.client.get("/public/menu", params={"mess_token": second_token}).json()
        self.assertEqual(second_menu, [])

    def test_invalid_and_duplicate_weekly_slots_are_rejected(self):
        duplicate = [self.item(0, "Dal"), self.item(0, "Roti")]
        response = self.client.put("/owner/weekly-menu", headers=self.owner, json={"items": duplicate})
        self.assertEqual(response.status_code, 422)
        invalid_time = self.client.put("/owner/weekly-menu", headers=self.owner,
                                       json={"items": [self.item(0, "Dal", cutoff_time="28:90")]})
        self.assertEqual(invalid_time.status_code, 422)


if __name__ == "__main__":
    unittest.main()
