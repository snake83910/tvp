"""
Tests de la rétention des tâches d'envoi d'email.

`asyncio.create_task` ne suffit pas : la boucle d'événements ne garde
qu'une référence FAIBLE vers les tâches, et le ramasse-miettes peut en
collecter une **en pleine exécution**. Les vingt appels à
`fire_and_forget` du site jettent leur valeur de retour ; sans ensemble
de rétention, une confirmation de commande pouvait disparaître avant
d'être envoyée — sans erreur, sans trace, et donc sans moyen de savoir
que ça arrivait.

Ces tests vérifient les deux garanties : la tâche est retenue tant
qu'elle tourne, et relâchée ensuite (sinon l'ensemble deviendrait une
fuite mémoire).

Lancer : pytest app/tests/test_mailer_tasks.py
"""
import asyncio
import gc

import pytest

from app.modules.mailer import base


@pytest.fixture(autouse=True)
def _ensemble_vide():
    base._pending.clear()
    yield
    base._pending.clear()


@pytest.mark.asyncio
async def test_tache_retenue_pendant_son_execution():
    demarree = asyncio.Event()
    liberer = asyncio.Event()

    async def envoi():
        demarree.set()
        await liberer.wait()
        return True

    # Valeur de retour JETÉE, comme partout dans le code métier.
    base.fire_and_forget(envoi())
    await demarree.wait()

    # Un cycle de ramasse-miettes au pire moment : la tâche doit
    # survivre. C'est exactement le scénario qui perdait des emails.
    gc.collect()
    assert len(base._pending) == 1

    liberer.set()
    await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_tache_relachee_une_fois_finie():
    """Sans le retrait, l'ensemble grossirait indéfiniment : on aurait
    remplacé une perte d'email par une fuite mémoire."""
    async def envoi():
        return True

    task = base.fire_and_forget(envoi())
    await task
    # Le callback de fin s'exécute au tour de boucle suivant.
    await asyncio.sleep(0)

    assert base._pending == set()


@pytest.mark.asyncio
async def test_un_envoi_qui_echoue_ne_bloque_pas_l_ensemble():
    """Un mail raté ne doit pas laisser une entrée fantôme derrière lui."""
    async def envoi():
        raise RuntimeError("SMTP muet")

    task = base.fire_and_forget(envoi())
    with pytest.raises(RuntimeError):
        await task
    await asyncio.sleep(0)

    assert base._pending == set()


@pytest.mark.asyncio
async def test_drain_attend_les_envois_en_cours():
    """À l'arrêt du serveur : sans attente, un redéploiement tue les
    emails partis une seconde plus tôt."""
    fini = []

    async def envoi():
        await asyncio.sleep(0.05)
        fini.append(True)

    base.fire_and_forget(envoi())
    base.fire_and_forget(envoi())

    attendues = await base.drain_pending(timeout=2.0)

    assert attendues == 2
    assert len(fini) == 2


@pytest.mark.asyncio
async def test_drain_borne_dans_le_temps():
    """Mieux vaut perdre un email qu'empêcher le processus de s'arrêter."""
    async def interminable():
        await asyncio.sleep(30)

    base.fire_and_forget(interminable())
    # Ne doit pas attendre trente secondes.
    await asyncio.wait_for(base.drain_pending(timeout=0.05), timeout=2.0)


@pytest.mark.asyncio
async def test_drain_sans_rien_en_cours():
    assert await base.drain_pending() == 0
