import Foundation
import AppKit
import PDFKit
import Vision

struct OCRResult {
    let pageIndex: Int
    let text: String
}

func renderPage(_ page: PDFPage, scale: CGFloat) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          ) else {
        return nil
    }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.saveGState()
    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: scale, y: -scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()

    return context.makeImage()
}

func recognizeText(from image: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["ja-JP", "en-US"]
    request.minimumTextHeight = 0.005

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    let ordered = observations.sorted {
        if abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.01 {
            return $0.boundingBox.midY > $1.boundingBox.midY
        }
        return $0.boundingBox.minX < $1.boundingBox.minX
    }

    return ordered.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

func main() throws {
    guard CommandLine.arguments.count >= 2 else {
        fputs("usage: swift pdf_ocr.swift <pdf-path> [scale]\n", stderr)
        exit(2)
    }

    let pdfPath = CommandLine.arguments[1]
    let scale = CommandLine.arguments.count >= 3 ? CGFloat(Double(CommandLine.arguments[2]) ?? 2.0) : 2.0

    guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
        fputs("failed to open pdf: \(pdfPath)\n", stderr)
        exit(1)
    }

    var results: [OCRResult] = []
    for pageIndex in 0..<document.pageCount {
        guard let page = document.page(at: pageIndex),
              let image = renderPage(page, scale: scale) else {
            continue
        }
        let text = try recognizeText(from: image)
        results.append(OCRResult(pageIndex: pageIndex + 1, text: text))
    }

    for result in results {
        print("=== PAGE \(result.pageIndex) ===")
        print(result.text)
    }
}

try main()
