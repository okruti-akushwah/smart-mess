"""Translate allowlisted saved public descriptions; never accept arbitrary input text."""
import hashlib
import html
import json
import os
import re
import threading
import time
from collections import OrderedDict
from typing import Literal
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app import models
from app.database import get_db

router = APIRouter(tags=['translations'])
_CACHE = OrderedDict()
_LOCK = threading.Lock()
_PROVIDER_LOCK = threading.Lock()
_LIMITS = {}
_DAILY_USAGE = [None,0]
TTL = 30 * 24 * 3600
FIELDS = {'meal': (models.Meal, {'menu_description'}), 'offer': (models.PlanOffer, {'description'}),
          'mess': (models.MessProfile, {'about', 'preparation', 'tagline', 'business_type', 'food_type', 'service_type', 'operating_days'})}

class Record(BaseModel):
    kind: Literal['meal','offer','mess']
    id: int = Field(gt=0)
    field: str = Field(max_length=40)

class TranslationInput(BaseModel):
    records: list[Record] = Field(min_length=1,max_length=20)
    language: Literal['hi','en'] = 'hi'


def cache_get(key):
    with _LOCK:
        cached = _CACHE.get(key)
        if cached and cached[0] > time.time():
            _CACHE.move_to_end(key)
            return cached[1]
    url = os.getenv('TRANSLATION_REDIS_REST_URL','').rstrip('/')
    token = os.getenv('TRANSLATION_REDIS_REST_TOKEN','')
    if url and token:
        try:
            response = httpx.post(url, headers={'Authorization':'Bearer '+token},json=['GET',key],timeout=3)
            response.raise_for_status()
            value = response.json().get('result')
            if value:
                value = json.loads(value)
                if isinstance(value,str):
                    cache_set_memory(key,value)
                    return value
        except (httpx.HTTPError,ValueError,TypeError):
            pass
    return None


def cache_set_memory(key,value):
    with _LOCK:
        _CACHE[key]=(time.time()+TTL,value)
        _CACHE.move_to_end(key)
        while len(_CACHE)>1000:
            _CACHE.popitem(last=False)


def cache_set(key,value):
    cache_set_memory(key,value)
    url=os.getenv('TRANSLATION_REDIS_REST_URL','').rstrip('/')
    token=os.getenv('TRANSLATION_REDIS_REST_TOKEN','')
    if url and token:
        try:
            httpx.post(url,headers={'Authorization':'Bearer '+token},json=['SET',key,json.dumps(value),'EX',TTL],timeout=3).raise_for_status()
        except httpx.HTTPError:
            pass


def translate_sources(sources):
    key=os.getenv('GOOGLE_TRANSLATE_API_KEY','').strip()
    if not key:
        return None
    day=time.strftime('%Y-%m-%d',time.gmtime())
    try:limit=max(0,int(os.getenv('TRANSLATION_DAILY_CHARACTER_LIMIT','50000')))
    except ValueError:limit=50000
    with _LOCK:
        if _DAILY_USAGE[0]!=day:_DAILY_USAGE[:]=[day,0]
        characters=sum(len(text) for text in sources)
        if _DAILY_USAGE[1]+characters>limit:return None
        _DAILY_USAGE[1]+=characters
    response=httpx.post('https://translation.googleapis.com/language/translate/v2',
        headers={'X-Goog-Api-Key':key},json={'q':sources,'source':'en','target':'hi','format':'text'},timeout=12)
    response.raise_for_status()
    return [html.unescape(row['translatedText']) for row in response.json()['data']['translations']]


@router.post('/translations')
def translate_records(body:TranslationInput, request:Request, db:Session=Depends(get_db)):
    identity=request.client.host if request.client else 'unknown'
    with _LOCK:
        now=time.time()
        if len(_LIMITS)>5000:
            for key in list(_LIMITS):
                if _LIMITS[key][0]<now-60:_LIMITS.pop(key,None)
        start,count=_LIMITS.get(identity,(now,0))
        if now-start>=60:start,count=now,0
        if count>=60:raise HTTPException(429,'Translation request limit reached')
        _LIMITS[identity]=(start,count+1)
    result=[]
    pending={}
    total=0
    for record in body.records:
        model,allowed=FIELDS[record.kind]
        if record.field not in allowed:raise HTTPException(422,'This field is not translatable')
        item=db.get(model,record.id)
        if not item:raise HTTPException(404,'Public content not found')
        owner=db.get(models.User,item.owner_id)
        if not owner or owner.role!='owner' or (record.kind=='offer' and not item.active):
            raise HTTPException(404,'Public content not found')
        source=getattr(item,record.field) or ''
        total+=len(source)
        if total>20000:raise HTTPException(413,'Translation batch is too large')
        profile=item if record.kind=='mess' else db.get(models.MessProfile,item.owner_id)
        override=getattr(profile,record.field+'_hi','') if record.kind=='mess' else ''
        row={**record.model_dump(),'source':source,'text':source,'translated':False}
        result.append(row)
        if body.language=='en' or not source.strip():continue
        if override:
            row.update(text=override,translated=True)
            continue
        if re.search('[\u0900-\u097f]',source):continue
        names=[name for name in [owner.name,profile.name if profile else None,'Smart Mess'] if name]
        protected={}
        masked=source
        for name in sorted(names,key=len,reverse=True):
            if name in masked:
                marker=f'__SM{len(protected)}__';protected[marker]=name;masked=masked.replace(name,marker)
        def protect(match):
            marker=f'__SM{len(protected)}__';protected[marker]=match[0];return marker
        masked=re.sub(r'https?://\S+|[\w.+-]+@[\w.-]+\.\w+|(?<![A-Za-z])\d[\d.,:/-]*',protect,masked)
        cache_key='sm:translation:v1:'+hashlib.sha256(json.dumps([source,names,'en','hi'],ensure_ascii=False).encode()).hexdigest()
        cached=cache_get(cache_key)
        if cached:
            row.update(text=cached,translated=True)
        else:
            pending.setdefault(cache_key,{'masked':masked,'protected':protected,'rows':[]})['rows'].append(row)
    if pending:
        with _PROVIDER_LOCK:
            # Another concurrent request may have populated these entries.
            for key,item in list(pending.items()):
                cached=cache_get(key)
                if cached:
                    for row in item['rows']:row.update(text=cached,translated=True)
                    pending.pop(key)
            if pending:
                try:
                    outputs=translate_sources([item['masked'] for item in pending.values()])
                    if outputs and len(outputs)==len(pending):
                        for (key,item),output in zip(pending.items(),outputs):
                            if not isinstance(output,str) or not all(marker in output for marker in item['protected']):continue
                            for marker,value in item['protected'].items():output=output.replace(marker,value)
                            cache_set(key,output)
                            for row in item['rows']:row.update(text=output,translated=True)
                except (httpx.HTTPError,ValueError,KeyError,TypeError):
                    pass  # English fallback; never expose provider errors or credentials.
    return {'translations':result}
