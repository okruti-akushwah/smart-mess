"""Straight-line discovery distances; no customer coordinates are stored."""
from math import asin, cos, radians, sin, sqrt


def distance_km(latitude, longitude, other_latitude, other_longitude):
    lat, other = radians(latitude), radians(other_latitude)
    dlat, dlon = other - lat, radians(other_longitude - longitude)
    chord = sin(dlat / 2) ** 2 + cos(lat) * cos(other) * sin(dlon / 2) ** 2
    return 6371.0088 * 2 * asin(sqrt(max(0, min(1, chord))))
