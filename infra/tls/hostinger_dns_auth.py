#!/usr/bin/env python3
"""Certbot DNS-01 hook scoped to Tavixo's single ACME TXT record.

Retains one public validation TXT between renewals instead of deleting records.
Never edits app A, apex, mail, nameservers, or other TXT records.
"""
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.request

DOMAIN = "app.birriaelcachanilla.com.mx"
ZONE = "birriaelcachanilla.com.mx"
NAME = "_acme-challenge.app"
FQDN = NAME + "." + ZONE
DIRECTORY = Path("/etc/tavixo-acme")
BASE = "https://developers.hostinger.com/api/dns/v1/zones/" + ZONE


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def private_read(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
        raise RuntimeError("ACME credential/state must be a root-owned private regular file")
    return path.read_text().strip()


def save_state(path, values):
    temporary = path.with_suffix(".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as file:
        json.dump({"owned_values": sorted(values)}, file)
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)


class API:
    def __init__(self, token):
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect())

    def call(self, method, body=None, validate=False):
        request = urllib.request.Request(
            BASE + ("/validate" if validate else ""),
            method=method,
            headers={"Authorization": "Bearer " + self.token,
                     "Content-Type": "application/json", "Accept": "application/json",
                     "User-Agent": "tavixo-certbot-dns/1.0"},
            data=json.dumps(body).encode() if body is not None else None,
        )
        try:
            with self.opener.open(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Never include API response bodies, request objects or credentials in logs.
            raise RuntimeError("Hostinger DNS API returned HTTP " + str(error.code)) from None
        except urllib.error.URLError:
            raise RuntimeError("Hostinger DNS API connection failed") from None


def current_values(zone):
    if not isinstance(zone, list):
        raise RuntimeError("Unexpected DNS response")
    values = set()
    for row in zone:
        name = row.get("name", "").rstrip(".")
        if name not in (NAME, FQDN):
            continue
        if row.get("type") != "TXT":
            raise RuntimeError("ACME name already has an unmanaged record")
        for record in row.get("records", []):
            if record.get("is_disabled", False):
                raise RuntimeError("ACME name contains a disabled record; inspect manually")
            content = record["content"]
            # APIs may return the TXT presentation form with quotes.
            if content.startswith('"') and content.endswith('"'):
                content = content[1:-1]
            values.add(content)
    return values


def publish(api, state_path, validation):
    owned = set(json.loads(private_read(state_path))["owned_values"]) if state_path.exists() else set()
    existing = current_values(api.call("GET"))
    if not existing.issubset(owned):
        raise RuntimeError("Unmanaged ACME TXT found; refusing to overwrite it")
    body = {"overwrite": True, "zone": [{"name": NAME, "type": "TXT", "ttl": 300,
                                        "records": [{"content": validation}]}]}
    api.call("POST", body, validate=True)
    # Remember ownership before PUT so a timeout can be retried without losing it.
    save_state(state_path, owned | {validation})
    api.call("PUT", body)
    if current_values(api.call("GET")) != {validation}:
        raise RuntimeError("Hostinger has not confirmed the requested ACME TXT")
    save_state(state_path, {validation})


def dig(*args):
    result = subprocess.run(["dig", "+time=3", "+tries=1", "+short", *args],
                            check=True, capture_output=True, text=True, timeout=6)
    return result.stdout.splitlines()


def wait_dns(validation, seconds=900):
    servers = [s.rstrip(".") for s in dig("NS", ZONE)]
    if not servers or any(not re.fullmatch(r"[A-Za-z0-9.-]+", s) for s in servers):
        raise RuntimeError("Could not discover authoritative DNS servers")
    servers += ["1.1.1.1", "8.8.8.8"]
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        ready = True
        for server in servers:
            try:
                answers = dig("@" + server, "TXT", FQDN)
                ready = ready and ('"' + validation + '"') in answers
            except (subprocess.SubprocessError, OSError):
                ready = False
        if ready:
            print("Tavixo ACME TXT propagated to authoritative and recursive DNS", file=sys.stderr)
            return
        time.sleep(10)
    raise RuntimeError("ACME TXT propagation timed out; certificate was not changed")


def main():
    domain, validation = os.environ.get("CERTBOT_DOMAIN"), os.environ.get("CERTBOT_VALIDATION", "")
    if domain != DOMAIN or not re.fullmatch(r"[A-Za-z0-9_-]{43}", validation):
        raise RuntimeError("Hook accepts only Tavixo's domain and a DNS-01 SHA256 validation")
    directory = DIRECTORY.lstat()
    if not stat.S_ISDIR(directory.st_mode) or directory.st_uid != 0 or directory.st_mode & 0o077:
        raise RuntimeError("ACME configuration directory must be private and owned by root")
    token = private_read(DIRECTORY / "hostinger-token")
    if not token or re.search(r"\s", token):
        raise RuntimeError("Missing or malformed Hostinger credential")
    with (DIRECTORY / "renew.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        publish(API(token), DIRECTORY / "state.json", validation)
        wait_dns(validation)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Only controlled messages; unexpected API/JSON exceptions are not dumped.
        print(str(error) if isinstance(error, RuntimeError) else "Tavixo DNS hook failed; inspect configuration", file=sys.stderr)
        sys.exit(1)
