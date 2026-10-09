import httpx
from datetime import date, timedelta, datetime, timezone
c=httpx.Client(base_url='http://127.0.0.1:8001')
for phone,role in [('9000000001','owner'),('9000000002','customer')]:
 c.post('/auth/signup',json={'name':f'Demo {role.title()}','phone':phone,'password':'Demo1234','role':role})
owner=c.post('/auth/login',json={'phone':'9000000001','password':'Demo1234'}).json()
h={'Authorization':'Bearer '+owner['access_token']}
customer=next(u for u in c.get('/owner/customers',headers=h).json() if u['phone']=='9000000002')
c.post('/owner/plans',headers=h,json={'user_id':customer['id'],'price':3000,'meal_price':50,'start_date':date.today().isoformat(),'end_date':(date.today()+timedelta(days=30)).isoformat()})
for day in [0,1,2]:
 for kind,menu in [('breakfast','Poha, fresh fruit & masala chai'),('lunch','Paneer curry, dal, rice & soft rotis'),('dinner','Seasonal sabzi, dal tadka & jeera rice')]:
  c.post('/owner/meals',headers=h,json={'date':(date.today()+timedelta(days=day)).isoformat(),'meal_type':kind,'menu_description':menu,'cutoff_time':(datetime.now(timezone.utc)+timedelta(days=day,hours=3)).isoformat()})
print('Isolated preview seeded with 9 meals and two demo accounts.')
