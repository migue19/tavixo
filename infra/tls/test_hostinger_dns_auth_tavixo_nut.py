import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("hook", Path(__file__).with_name("hostinger_dns_auth_tavixo_nut.py"))
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)

class FakeAPI:
    def __init__(self, rows): self.rows, self.writes = rows, []
    def call(self, method, body=None, validate=False):
        if method == "GET": return self.rows
        self.writes.append((method, body, validate))
        if method == "PUT":
            self.rows = [r for r in self.rows if r["name"] != hook.NAME] + body["zone"]
        return {"message": "OK"}

class DNSHookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = Path(self.tmp.name) / "state.json"
        self.read_patch = patch.object(hook, "private_read", lambda p: p.read_text().strip())
        self.read_patch.start()
    def tearDown(self): self.read_patch.stop(); self.tmp.cleanup()
    def test_publish_validates_and_changes_only_acme_txt(self):
        rows = [{"name":"app", "type":"A", "records":[{"content":"82.180.139.70"}]}]
        api = FakeAPI(rows.copy())
        hook.publish(api, self.state, "A"*43)
        self.assertEqual(api.rows[0], rows[0])
        self.assertEqual([c[0] for c in api.writes], ["POST", "PUT"])
        self.assertTrue(api.writes[0][2])
        self.assertEqual(set(api.writes[1][1]), {"overwrite", "zone"})
        self.assertEqual(len(api.writes[1][1]["zone"]), 1)
        self.assertEqual(self.state.stat().st_mode & 0o777, 0o600)
    def test_renews_known_txt_without_accumulating_records(self):
        api = FakeAPI([])
        hook.publish(api, self.state, "A"*43)
        hook.publish(api, self.state, "B"*43)
        self.assertEqual(hook.current_values(api.rows), {"B"*43})
        self.assertEqual(json.loads(self.state.read_text())["owned_values"], ["B"*43])
    def test_refuses_foreign_txt_or_cname_before_any_write(self):
        for kind in ("TXT", "CNAME"):
            api = FakeAPI([{"name":hook.NAME,"type":kind,"records":[{"content":"foreign"}]}])
            with self.assertRaises(RuntimeError): hook.publish(api, self.state, "A"*43)
            self.assertEqual(api.writes, [])
    def test_preserves_retry_ownership_after_uncertain_update(self):
        api = FakeAPI([])
        original = api.call
        def uncertain(method, body=None, validate=False):
            result = original(method,body,validate)
            if method == "PUT": raise RuntimeError("timeout")
            return result
        api.call = uncertain
        with self.assertRaises(RuntimeError): hook.publish(api,self.state,"A"*43)
        api.call = original
        hook.publish(api,self.state,"B"*43)
        self.assertEqual(hook.current_values(api.rows), {"B"*43})
    def test_domain_and_validation_restriction(self):
        for domain, token in (("other.example", "A"*43),(hook.DOMAIN,"bad")):
            with patch.dict(os.environ,{"CERTBOT_DOMAIN":domain,"CERTBOT_VALIDATION":token}):
                with self.assertRaises(RuntimeError): hook.main()
    def test_dns_requires_all_servers_to_confirm(self):
        calls=[]
        def dig(*args):
            calls.append(args)
            return ["nova.dns-parking.com.", "cosmos.dns-parking.com."] if args[0]=="NS" else ['"' + 'A'*43 + '"']
        with patch.object(hook, "dig", dig): hook.wait_dns("A"*43,seconds=1)
        self.assertEqual(len(calls),5)
    def test_no_redirect_for_credentials(self):
        self.assertIsNone(hook.NoRedirect().redirect_request(None,None,302,None,None,"https://other.example"))

if __name__ == "__main__": unittest.main()
