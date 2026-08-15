"""
Tests du moteur de créneaux de montage.

Un créneau mal calculé, c'est un client qui se déplace avant que ses
pneus soient arrivés, ou un garage rideau baissé à l'heure du rendez-vous.
Ces cas DOIVENT rester verts.

Lancer : pytest app/tests/test_booking.py
"""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.modules.garage.booking import (
    DEFAULT_TRANSIT_DAYS,
    day_ranges,
    day_slot_starts,
    delivery_estimate_date,
    earliest_mounting_date,
    is_closed_period,
)

# 2026-08-17 est un lundi, 2026-08-22 un samedi, 2026-08-23 un dimanche.
LUNDI = date(2026, 8, 17)
SAMEDI = date(2026, 8, 22)
DIMANCHE = date(2026, 8, 23)

HORAIRES = {
    "lundi": {"open": "08:00", "close": "18:00"},
    "samedi": {"open": "09:00", "close": "12:00"},
    "dimanche": {"closed": True},
}


def garage(**kw):
    """Garage minimal : seuls les champs lus par le moteur de créneaux."""
    base = dict(
        hours=HORAIRES,
        closures=[],
        slot_minutes=30,
        slot_capacity=1,
        appointment_lead_days=1,
        appointments_enabled=True,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def item(delivery_estimate=None):
    return SimpleNamespace(
        product_data={"delivery_estimate": delivery_estimate}
    )


# ── Plages d'ouverture ────────────────────────────────────────────────

def test_journee_simple():
    assert day_ranges(HORAIRES, LUNDI) == [
        (__import__("datetime").time(8, 0), __import__("datetime").time(18, 0))
    ]


def test_jour_ferme_explicitement():
    assert day_ranges(HORAIRES, DIMANCHE) == []


def test_jour_absent_du_planning_est_ferme():
    # Mardi n'est pas déclaré : pas d'ouverture par défaut.
    assert day_ranges(HORAIRES, LUNDI + timedelta(days=1)) == []


def test_pause_dejeuner_coupe_la_journee_en_deux():
    hours = {"lundi": {"open": "08:00", "close": "18:00",
                       "break_start": "12:00", "break_end": "14:00"}}
    ranges = day_ranges(hours, LUNDI)
    assert len(ranges) == 2
    assert ranges[0][1].hour == 12 and ranges[1][0].hour == 14


def test_pause_incoherente_est_ignoree():
    # Pause qui déborde de la journée : on garde la plage entière plutôt
    # que de produire des créneaux aberrants.
    hours = {"lundi": {"open": "08:00", "close": "18:00",
                       "break_start": "19:00", "break_end": "20:00"}}
    assert len(day_ranges(hours, LUNDI)) == 1


def test_fermeture_avant_ouverture_est_rejetee():
    hours = {"lundi": {"open": "18:00", "close": "08:00"}}
    assert day_ranges(hours, LUNDI) == []


def test_horaires_texte_libre_ne_produisent_aucun_creneau():
    # Ancien format {"text": "Lun-Ven 8h-18h"} : illisible par machine.
    assert day_ranges({"text": "Lun-Ven 8h-18h"}, LUNDI) == []


# ── Découpage en créneaux ─────────────────────────────────────────────

def test_nombre_de_creneaux_par_jour():
    # 08:00 -> 18:00 = 10 h, par pas de 30 min = 20 créneaux.
    assert len(day_slot_starts(garage(), LUNDI)) == 20


def test_dernier_creneau_tient_avant_la_fermeture():
    # Samedi 09:00 -> 12:00 avec des créneaux de 45 min : 09:00, 09:45,
    # 10:30, 11:15 (fin 12:00). Pas de créneau à 12:00.
    slots = day_slot_starts(garage(slot_minutes=45), SAMEDI)
    assert len(slots) == 4
    assert slots[-1].hour == 11 and slots[-1].minute == 15


def test_pause_dejeuner_ne_genere_pas_de_creneau():
    g = garage(
        hours={"lundi": {"open": "08:00", "close": "18:00",
                         "break_start": "12:00", "break_end": "14:00"}}
    )
    heures = {(s.hour, s.minute) for s in day_slot_starts(g, LUNDI)}
    assert (12, 30) not in heures
    assert (11, 30) in heures and (14, 0) in heures


def test_conge_ferme_toute_la_journee():
    g = garage(closures=[{"start": "2026-08-15", "end": "2026-08-20",
                          "label": "Congés d'été"}])
    assert day_slot_starts(g, LUNDI) == []
    assert is_closed_period(g.closures, LUNDI) == "Congés d'été"
    assert is_closed_period(g.closures, SAMEDI) is None


# ── Date au plus tôt ──────────────────────────────────────────────────

def test_livraison_estimee_est_la_plus_tardive_du_panier():
    items = [item("2026-08-19"), item("2026-08-21"), item("2026-08-20")]
    assert delivery_estimate_date(items) == date(2026, 8, 21)


def test_livraison_estimee_absente():
    assert delivery_estimate_date([item(None), item()]) is None


def test_rdv_au_plus_tot_est_j_plus_1_apres_la_livraison():
    g = garage()
    first = earliest_mounting_date(g, [item("2026-08-19")], today=date(2026, 8, 15))
    assert first == date(2026, 8, 20)


def test_delai_configurable_par_le_garage():
    g = garage(appointment_lead_days=3)
    first = earliest_mounting_date(g, [item("2026-08-19")], today=date(2026, 8, 15))
    assert first == date(2026, 8, 22)


def test_delai_nul_est_ramene_a_j_plus_1():
    # Le minimum métier est J+1 : jamais le jour même de la livraison.
    g = garage(appointment_lead_days=0)
    first = earliest_mounting_date(g, [item("2026-08-19")], today=date(2026, 8, 15))
    assert first == date(2026, 8, 20)


def test_sans_estimation_on_applique_un_delai_de_transport_prudent():
    today = date(2026, 8, 15)
    first = earliest_mounting_date(garage(), [item(None)], today=today)
    assert first == today + timedelta(days=DEFAULT_TRANSIT_DAYS + 1)


def test_estimation_perimee_ne_permet_pas_un_rdv_dans_le_passe():
    # Une date de livraison déjà dépassée (panier ancien) ne doit pas
    # ouvrir des créneaux antérieurs à aujourd'hui.
    today = date(2026, 8, 15)
    first = earliest_mounting_date(garage(), [item("2026-07-01")], today=today)
    assert first > today


@pytest.mark.parametrize("value", ["2026-08-19T10:30:00", "2026-08-19"])
def test_formats_de_date_fournisseur_acceptes(value):
    assert delivery_estimate_date([item(value)]) == date(2026, 8, 19)


def test_date_fournisseur_illisible_est_ignoree():
    assert delivery_estimate_date([item("bientôt")]) is None
