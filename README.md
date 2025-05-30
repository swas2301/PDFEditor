# 📝 PDF Editor in Browser

A web-based PDF editor that allows users to **view**, **fill**, and **edit** PDF forms directly in the browser in real-time. Supports **text fields**, **checkboxes**, and exporting the edited PDF either by downloading or saving to a server.

---

## ✨ Features

- 📄 View and render PDF with form fields in the browser
- ✍️ Fill text input fields in real-time
- ☑️ Tick/untick checkboxes
- 🔄 Real-time visual updates on PDF
- 💾 Save filled PDF to server or download directly

---

## 🛠️ Tech Stack

### Frontend:
- **React.js**
- `pdf-lib`, `pdfjs-dist` for rendering and manipulation
- HTML Canvas for PDF rendering

### Backend:
- **NestJS**
- Handles saving the edited PDF on the server

---

## 🚀 Getting Started

### 📦 Clone the repository

```bash
git clone https://github.com/swas2301/PDFEditor.git
cd PDFEditor
```
### Run Backend

```bash
cd backend
npm install
npm run start
```
### Run Frontend

```bash
cd frontend
npm install
npm start
```

