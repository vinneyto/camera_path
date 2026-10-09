import base64
import unittest
from unittest.mock import Mock, patch

from test_deploy import load

p = load("provider", "provider/release.py")


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.event = {
            "RequestType": "Update", "RequestId": "test-request",
            "ResourceProperties": {"Revision": "a" * 40, "InstanceId": "i-test",
                                   "Script": base64.b64encode(b"print('test')").decode(), "TlsScript": base64.b64encode(b"print('tls')").decode(), "Config": {}},
        }
        self.ssm = Mock()
        self.ssm.get_paginator.return_value.paginate.return_value = [{"Commands": []}]
        self.ssm.describe_instance_information.return_value = {"InstanceInformationList": []}
        patcher = patch.object(p.boto3, "client", return_value=self.ssm)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_waits_for_managed_node(self):
        self.assertFalse(p.is_complete(self.event, None)["IsComplete"])
        self.ssm.send_command.assert_not_called()

    def test_submission_is_not_deployment_success(self):
        self.ssm.describe_instance_information.return_value = {
            "InstanceInformationList": [{"PingStatus": "Online"}]
        }
        self.assertFalse(p.is_complete(self.event, None)["IsComplete"])
        self.ssm.send_command.assert_called_once()
        command = self.ssm.send_command.call_args.kwargs['Parameters']['commands'][0]
        self.assertLess(command.index('python /etc/camera-path/configure-https.py'),
                        command.index('python /etc/camera-path/release-'))

    def test_existing_command_is_polled_without_resubmitting(self):
        self.ssm.get_paginator.return_value.paginate.return_value = [
            {"Commands": [{"Comment": "camera-path-test-request", "CommandId": "cmd"}]}]
        for status in ["Pending", "InProgress", "Success"]:
            self.ssm.get_command_invocation.return_value = {"Status": status}
            self.assertEqual(p.is_complete(self.event, None)["IsComplete"], status == "Success")
        self.ssm.send_command.assert_not_called()

    def test_release_failure_fails_cloudformation(self):
        self.ssm.get_paginator.return_value.paginate.return_value = [
            {"Commands": [{"Comment": "camera-path-test-request", "CommandId": "cmd"}]}]
        self.ssm.get_command_invocation.return_value = {"Status": "Failed"}
        with self.assertRaisesRegex(RuntimeError, "Backend release failed"):
            p.is_complete(self.event, None)

    def test_delete_does_not_touch_ec2_or_database(self):
        self.event["RequestType"] = "Delete"
        self.assertTrue(p.is_complete(self.event, None)["IsComplete"])
        p.boto3.client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
