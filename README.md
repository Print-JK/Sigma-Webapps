# Sigma Webapps
A client side local hosted tool where you could use and bring anywhere!

## Overview
This project is a collection of self-contained, client-side web tools designed to run entirely offline and locally via a standard web browser. The goal is to provide a unified hub for personal file management, encryption, conversion, and text extraction without requiring any external hosting or third-party dependencies.

This application is architected as a modular system, where each tool operates in isolation but can be accessed through a central index page. This application is strictly intended for local execution only.

## Architecture & Setup
The project employs a modular structure to ensure that each feature remains self-contained and dependency-free.

## File Structure:
```
SIGMA-WEBAPPS/
├── assets/
│   ├── FileConvert.png
│   ├── fileprev.jpg
│   ├── Home.gif
│   ├── LocalPreview.jpg
│   ├── OCR.png
│   ├── passman.jpg
│   ├── temp.jpg
│   └── wip.jpg
│
├── FileConvert/
│   ├── index.html
│   └── styles.css
│
├── FilePreview/
│   ├── FilePrev.js
│   ├── index.html
│   ├── jszip.min.js
│   └── style.css
│
├── LocalOCR/
│   ├── index.html
│   ├── OCR.js
│   ├── pdf.min.js
│   ├── pdf.worker.min.js
│   ├── style.css
│   └── tesseract.min.js
│
├── Main/
│   └── index.html
│
├── PassMan/
│   ├── Index.html
│   ├── PassMan.js
│   └── style.css
│
├── ZIPencrypt/
│   └── index.html
│
├── LICENSE
└── README.md

```

## How to Run Locally:

Ensure all files are present in the project directory structure.
Navigate to the main entry file: Sigma-Webapps/Main/index.html in your local file explorer.
Click the cards provided on the Mainpage to access the specific tools.

## Features
The application currently encompasses the following functional modules:

1. PassMan
Function: Securely encrypt and decrypt password data stored in CSV format using locally generated keys.
Capability: Local key file generation and secure local file interaction via browser APIs.
2. ZIPEncrypt
Function: Client-side encryption/decryption of ZIP archives.
Capability: Preview functionality for embedded media (PDF, PNG, GIF, PSD, MP4, most files that is supported by FilePreview) upon decryption.
3. FilePreview
Function: A single interface to load and preview various file types directly in the browser.
Supported Formats: PDF, PNG, JPG, GIF, PSD (Yes PSD too), MP4, MP3, CSV, and Markdown (MD).
4. FileConvert (still underdevlopment)
Function: Perform format conversions or merging entirely within the local browser environment, basically a knock-off local version of IlovePDF
Conversions includes:
- Merging PDF files
- Spliting PDF files
- PDF ↔ Word
- PDF ↔ PowerPoint
- PDF ↔ Excel
- JPG ↔ PDF
- PNG ↔ PDF

5. LocalOCR 
Function: Upload an image to extract text using a locally embedded Machine Learning model.
Capability: Extraction of both standard digital text and handwritten text from the uploaded image.

## Important Operational Notes (Constraints & Risks)
Local Execution Mandate: This application is not intended for online hosting. All file operations must be strictly confined to the local machine environment, as it may contain vulnerable code.
Dependency Constraint: The core principle of this project is zero external dependencies. Functionality relies on bundled or natively supported browser APIs and embedded JavaScript libraries only.
Conversion Fidelity Risk: Client-side format conversion (especially involving complex formats like PPTX) carries a risk of output imperfection due to the lack of full desktop rendering context. Use results for reference, not critical archival work.

## Note
This project is currently a personal development effort. Any feedback on usability, logic errors, or suggestions for future features are welcomed. Also if you can't tell already, yes this code is mostly made of slop like my other work, but hey you know what they say if it works it works, but do hope to oneday be able to do all these on my own.

