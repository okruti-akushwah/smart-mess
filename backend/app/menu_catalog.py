"""Reusable owner menu vocabulary, learned when menus are saved."""
import re
from app import models
DEFAULT_ITEMS = ['Daal', 'Roti', 'Raita', 'Salad', 'Rajma', 'Kadi']


def remember(db, owner_id, description):
    for text in re.split(r'[,;\n]+', description or ''):
        name = ' '.join(text.strip().split())
        if not name or len(name) > 100:
            continue
        key = name.casefold()
        if key in {item.casefold() for item in DEFAULT_ITEMS}:
            continue
        if not db.get(models.MenuItem, (owner_id, key)):
            db.add(models.MenuItem(owner_id=owner_id, key=key, name=name))
