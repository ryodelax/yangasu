import sys

import fitz
import Foundation
import Quartz
import Vision


def png_bytes_to_cgimage(png_bytes):
    data = Foundation.NSData.dataWithBytes_length_(png_bytes, len(png_bytes))
    source = Quartz.CGImageSourceCreateWithData(data, None)
    if source is None:
        raise RuntimeError("failed to create image source")
    image = Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)
    if image is None:
        raise RuntimeError("failed to decode PNG to CGImage")
    return image


def ocr_cgimage(image):
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(False)
    request.setRecognitionLanguages_(["ja-JP", "en-US"])

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(image, None)
    ok, error = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(str(error))

    results = request.results() or []
    items = []
    for obs in results:
        candidates = obs.topCandidates_(1)
        if not candidates:
            continue
        box = obs.boundingBox()
        items.append(
            {
                "text": str(candidates[0].string()),
                "x": box.origin.x,
                "y": box.origin.y,
                "h": box.size.height,
            }
        )

    items.sort(key=lambda item: (-item["y"], item["x"]))

    rows = []
    threshold = 0.012
    for item in items:
        if not rows or abs(rows[-1]["y"] - item["y"]) > threshold:
            rows.append({"y": item["y"], "items": [item]})
        else:
            rows[-1]["items"].append(item)

    lines = []
    for row in rows:
        row["items"].sort(key=lambda item: item["x"])
        line = "\t".join(item["text"] for item in row["items"])
        lines.append(line)
    return "\n".join(lines)


def ocr_pdf(pdf_path, scale):
    doc = fitz.open(pdf_path)
    for page_number, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        image = png_bytes_to_cgimage(pix.tobytes("png"))
        print(f"=== PAGE {page_number} ===")
        print(ocr_cgimage(image))


def main():
    if len(sys.argv) < 2:
        print("usage: python3 pdf_ocr.py <pdf-path> [scale]", file=sys.stderr)
        raise SystemExit(2)
    pdf_path = sys.argv[1]
    scale = float(sys.argv[2]) if len(sys.argv) >= 3 else 2.0
    ocr_pdf(pdf_path, scale)


if __name__ == "__main__":
    main()
