"""Politique de mots de passe.

- 10 caractères minimum
- Au moins une majuscule ET un chiffre OU un caractère spécial
- Pas dans la liste de mots de passe les plus courants
- (Optionnel) check HaveIBeenPwned via k-anonymity
"""
import re

# Top mots de passe à interdire (extraits des breaches connus)
COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890",
    "qwerty", "qwertyuiop", "azerty", "azertyuiop", "letmein", "welcome",
    "admin", "administrator", "root", "toor", "iloveyou", "monkey",
    "abc12345", "password!", "P@ssw0rd", "Password1", "motdepasse",
    "soleil123", "bonjour", "tousvospneus", "tousvospneus123",
}


def validate_password(pwd: str) -> str | None:
    """Retourne None si OK, sinon un message d'erreur en français."""
    if len(pwd) < 10:
        return "Mot de passe : 10 caractères minimum."
    if len(pwd) > 128:
        return "Mot de passe trop long (128 caractères maximum)."
    if pwd.lower() in COMMON_PASSWORDS:
        return "Ce mot de passe est trop courant. Choisissez-en un autre."
    has_upper = bool(re.search(r"[A-Z]", pwd))
    has_digit = bool(re.search(r"\d", pwd))
    has_special = bool(re.search(r"[^A-Za-z0-9]", pwd))
    if not has_upper:
        return "Mot de passe : au moins une majuscule requise."
    if not (has_digit or has_special):
        return "Mot de passe : au moins un chiffre ou caractère spécial requis."
    return None


async def is_pwned(pwd: str) -> bool:
    """Vérifie via HaveIBeenPwned (k-anonymity).

    Envoie seulement les 5 premiers caractères du SHA-1, reçoit la liste
    des suffixes connus. Aucune fuite du password complet.
    Retourne True si trouvé dans les breaches.
    """
    import hashlib

    import httpx

    sha = hashlib.sha1(pwd.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha[:5], sha[5:]
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={"Add-Padding": "true"},
            )
        if resp.status_code != 200:
            return False  # En cas d'API down, on n'empêche pas la création
        for line in resp.text.splitlines():
            if line.split(":")[0] == suffix:
                return True
        return False
    except Exception:
        return False  # Fail-open : ne pas bloquer en cas de panne réseau
