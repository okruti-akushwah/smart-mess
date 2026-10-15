from uuid import uuid4
from datetime import datetime
import test_app
from app import models
from app.migrate import upgrade
from sqlalchemy import text


class ChatTests(test_app.ApplicationTests):
    def send(self, headers, message, customer_id=None, key=None):
        return self.client.post('/chat/messages', headers=headers, json={
            'body': message, 'customer_id': customer_id, 'client_key': key or str(uuid4())})

    def test_customer_owner_roundtrip_unread_and_retry(self):
        key = str(uuid4())
        sent = self.send(self.customer, 'Is dinner available at 8?', key=key)
        self.assertEqual(sent.status_code, 201, sent.text)
        self.assertFalse(sent.json()['from_owner'])
        repeated = self.send(self.customer, 'Is dinner available at 8?', key=key)
        self.assertEqual(sent.json()['id'], repeated.json()['id'])
        self.assertEqual(self.send(self.customer, 'Changed message', key=key).status_code, 409)
        inbox = self.client.get('/chat/conversations', headers=self.owner).json()
        self.assertEqual(inbox[0]['unread'], 1)
        self.assertEqual(inbox[0]['last_incoming_id'], sent.json()['id'])
        self.assertEqual(inbox[0]['customer_id'], self.customer_id)
        fetched = self.client.get(f'/chat/messages?customer_id={self.customer_id}', headers=self.owner)
        self.assertEqual(fetched.json()['messages'][0]['body'], 'Is dinner available at 8?')
        read = self.client.patch('/chat/read', headers=self.owner, json={'customer_id': self.customer_id, 'last_message_id': sent.json()['id']})
        self.assertEqual(read.json()['read'], 1)
        self.assertEqual(self.client.get('/chat/conversations', headers=self.owner).json()[0]['unread'], 0)
        reply = self.send(self.owner, 'Yes, dinner is served until 9.', self.customer_id)
        self.assertEqual(reply.status_code, 201, reply.text)
        self.assertTrue(reply.json()['from_owner'])
        self.assertEqual(self.client.get('/chat/conversations', headers=self.owner).json()[0]['last_incoming_id'], sent.json()['id'])
        self.assertEqual(self.client.get('/chat/conversations', headers=self.customer).json()[0]['last_incoming_id'], reply.json()['id'])
        self.assertEqual(self.client.get('/chat/conversations', headers=self.customer).json()[0]['unread'], 1)
        new = self.client.get(f'/chat/messages?after_id={sent.json()["id"]}', headers=self.customer).json()
        self.assertEqual([row['id'] for row in new['messages']], [reply.json()['id']])

    def test_customer_and_mess_isolation(self):
        second, second_id = self.account('9876543215', 'customer')
        foreign_owner, _ = self.account('9876543216', 'owner')
        self.send(self.customer, 'Private question')
        self.assertEqual(self.client.get('/chat/messages').status_code, 401)
        self.assertEqual(self.client.get(f'/chat/messages?customer_id={self.customer_id}', headers=second).status_code, 403)
        self.assertEqual(self.send(second, 'Injected', self.customer_id).status_code, 403)
        self.assertEqual(self.client.get('/chat/messages', headers=second).json()['messages'], [])
        self.assertEqual(self.client.get(f'/chat/messages?customer_id={self.customer_id}', headers=foreign_owner).status_code, 404)
        self.assertEqual(self.send(foreign_owner, 'Injected', self.customer_id).status_code, 404)
        self.assertEqual(self.client.get('/chat/conversations', headers=foreign_owner).json(), [])

    def test_pending_membership_blocked_and_validation(self):
        with self.Session() as db:
            db.add(models.JoinRequest(owner_id=self.owner_id, user_id=self.customer_id, status='pending'))
            db.commit()
        self.assertEqual(self.send(self.customer, 'Hello').status_code, 403)
        self.assertEqual(self.send(self.owner, 'Hello', self.customer_id).status_code, 403)
        self.assertEqual(self.client.get('/chat/conversations', headers=self.owner).json(), [])
        self.assertEqual(self.send(self.owner, '  ', self.customer_id).status_code, 422)
        self.assertEqual(self.send(self.owner, 'x'*2001, self.customer_id).status_code, 422)

    def test_history_pagination_and_read_cursor(self):
        with self.Session() as db:
            db.add_all([models.ChatMessage(owner_id=self.owner_id, customer_id=self.customer_id,
                from_owner=False, body=f'Message {i}', client_key=str(uuid4())) for i in range(55)])
            db.commit()
        first = self.client.get(f'/chat/messages?customer_id={self.customer_id}', headers=self.owner).json()
        self.assertEqual(len(first['messages']), 50)
        self.assertTrue(first['has_more'])
        before = first['messages'][0]['id']
        earlier = self.client.get(f'/chat/messages?customer_id={self.customer_id}&before_id={before}', headers=self.owner).json()
        self.assertEqual(len(earlier['messages']), 5)
        self.assertFalse(earlier['has_more'])
        self.client.patch('/chat/read', headers=self.owner, json={'customer_id': self.customer_id, 'last_message_id': earlier['messages'][-1]['id']})
        self.assertEqual(self.client.get('/chat/conversations', headers=self.owner).json()[0]['unread'], 50)

    def test_additive_migration_preserves_existing_accounts(self):
        with self.engine.begin() as connection:
            models.ChatMessage.__table__.drop(connection)
            connection.execute(text("DELETE FROM app_schema_revisions WHERE revision='0007_in_app_chat'"))
        self.assertEqual(upgrade(self.engine), ['0007_in_app_chat'])
        self.assertEqual(upgrade(self.engine), [])
        with self.Session() as db:
            self.assertEqual(db.query(models.User).count(), 2)
            self.assertEqual(db.query(models.ChatMessage).count(), 0)
