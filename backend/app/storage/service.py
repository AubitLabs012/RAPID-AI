from pathlib import Path
from uuid import uuid4

from app.config import get_settings


class FileStorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def create_upload_target(self, filename: str, content_type: str) -> dict:
        safe_name = Path(filename).name
        if self.settings.s3_bucket and self.settings.s3_access_key and self.settings.s3_secret_key:
            import boto3

            object_name = f"uploads/{uuid4()}-{safe_name}"
            client = boto3.client(
                "s3",
                endpoint_url=self.settings.s3_endpoint_url or None,
                aws_access_key_id=self.settings.s3_access_key,
                aws_secret_access_key=self.settings.s3_secret_key,
            )
            return {
                "provider": "s3",
                "bucket": self.settings.s3_bucket,
                "object_name": object_name,
                "upload_url": client.generate_presigned_url(
                    "put_object",
                    Params={"Bucket": self.settings.s3_bucket, "Key": object_name, "ContentType": content_type},
                    ExpiresIn=900,
                ),
            }
        if self.settings.gcp_storage_bucket:
            return {
                "provider": "gcp-storage",
                "bucket": self.settings.gcp_storage_bucket,
                "object_name": f"uploads/{uuid4()}-{safe_name}",
                "content_type": content_type,
                "message": "Generate a signed upload URL here once GCP credentials are configured.",
            }

        local_dir = Path("backend/storage/uploads")
        local_dir.mkdir(parents=True, exist_ok=True)
        return {
            "provider": "local",
            "path": str(local_dir / f"{uuid4()}-{safe_name}"),
            "content_type": content_type,
        }
