import os
os.environ['DATABASE_URL']=os.getenv('QA_DATABASE_URL','sqlite:///./output/qa/workflow.db')
os.environ['SIGNUP_OTP_MODE']='off'
os.environ['SECRET_KEY']='disposable-qa-secret'
from app.main import app
from fastapi.testclient import TestClient
from datetime import date,timedelta,datetime,timezone
c=TestClient(app)
def call(method,path,**kw):
 r=getattr(c,method)(path,**kw)
 assert r.status_code<300,(path,r.text)
 return r.json()
call('post','/auth/signup',json={'name':'QA Owner','phone':'9000011111','password':'qa-test-123','role':'owner','mess_name':'QA Test Kitchen'})
o=call('post','/auth/login',json={'phone':'9000011111','password':'qa-test-123'})
h={'Authorization':'Bearer '+o['access_token']}
call('put','/owner/mess-profile',headers=h,json={'name':'QA Test Kitchen','address':'Test address','timings':[{'meal_type':'lunch','from_time':'12:00','to_time':'14:00'}]})
offer=call('post','/owner/offers',headers=h,json={'name':'QA Monthly','category':'regular','duration_days':30,'price':3000,'meal_price':50,'description':'Test subscription'})
token=call('get','/owner/join-link',headers=h)['token']
call('post',f'/join/{token}',json={'name':'QA Customer','phone':'9000022222','password':'qa-test-123','role':'customer','offer_id':offer['id'],'start_date':date.today().isoformat()})
requests=call('get','/owner/join-requests',headers=h)
call('patch',f"/owner/join-requests/{requests[0]['id']}",headers=h,json={'status':'approved'})
for day,kind in [(0,'lunch'),(1,'lunch'),(1,'dinner')]:
 call('post','/owner/meals',headers=h,json={'date':(date.today()+timedelta(days=day)).isoformat(),'meal_type':kind,'menu_description':'QA Daal, Roti','cutoff_time':(datetime.now(timezone.utc)+timedelta(days=day,hours=2)).isoformat()})
print('Isolated test database ready. Owner 9000011111, customer 9000022222, password qa-test-123.')
