from __future__ import annotations

import io

from app.api.schemas import MarineUploadRecord
from app.services.pdf_record_parser import PdfRecordParser


class ImageRecordParser:
    def extract_records(self, payload: bytes, filename: str) -> list[MarineUploadRecord]:
        text = self._extract_text(payload)
        return PdfRecordParser().extract_records_from_text(text, filename, source_prefix="image")

    def _extract_text(self, payload: bytes) -> str:
        try:
            from PIL import Image, ImageOps
        except ImportError as exc:
            raise RuntimeError("Install Pillow to upload image records: python -m pip install Pillow") from exc

        try:
            import pytesseract
        except ImportError as exc:
            raise RuntimeError("Install pytesseract to upload image records: python -m pip install pytesseract") from exc

        try:
            image = Image.open(io.BytesIO(payload))
            image = ImageOps.grayscale(image)
            return pytesseract.image_to_string(image)
        except pytesseract.TesseractNotFoundError as exc:
            raise RuntimeError("Install the Tesseract OCR app and add it to PATH before uploading image records.") from exc
        except Exception as exc:
            raise RuntimeError("Unable to read image text. Use a clear screenshot or photo of a table.") from exc
