import React, { useRef, useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry';
import fontkit from '@pdf-lib/fontkit';


pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function App() {
  const pdfContainerRef = useRef();
  const [pdfBytes, setPdfBytes] = useState(null);
  const [fields, setFields] = useState([]);
  const [checkboxes, setCheckboxes] = useState([]);
  const [viewport, setViewport] = useState(null);
  const [pdfPage, setPdfPage] = useState(null);
  const [pdfVisible, setPdfVisible] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const canvasRefs = useRef([]);
  const [pages, setPages] = useState([]); // Store canvas/page objects
  const [allFields, setAllFields] = useState([]); // [{ pageIndex, fields, checkboxes }]


  const loadPDF = async () => {
    try {
      setIsRendering(true);
      const res = await fetch('http://localhost:3000/pdf/load');
      const bytes = await res.arrayBuffer();
      setPdfBytes(bytes);
  
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const numPages = pdf.numPages;
      const pageCanvases = [];
      const allFieldData = [];
      const allCheckboxes = [];
  
      for (let i = 0; i < numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const vp = page.getViewport({ scale: 1.5 });
  
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = vp.width;
        canvas.height = vp.height;
  
        await page.render({ canvasContext: context, viewport: vp }).promise;
  
        const annotations = await page.getAnnotations();
        const textFields = [];
        const checkboxList = [];
  
        annotations.forEach((annot) => {
          if (annot.rect && (annot.fieldType === 'Tx' || annot.fieldType === 'Btn')) {
            const [x1, y1, x2, y2] = annot.rect;
            const x = x1 * (vp.width / page.view[2]);
            const y = vp.height - y2 * (vp.height / page.view[3]);
            const width = (x2 - x1) * (vp.width / page.view[2]);
            const height = (y2 - y1) * (vp.height / page.view[3]);
  
            if (annot.fieldType === 'Btn') {
              checkboxList.push({ x, y, width, height, checked: false });
            } else if (annot.fieldType === 'Tx') {
              textFields.push({ x, y, width, height, value: '', name: annot.fieldName });
            }
          }
        });
  
        allCheckboxes.push(...checkboxList);
  
        const imageUrl = canvas.toDataURL(); // 🔥 Convert canvas to image
  
        pageCanvases.push({ 
          pageIndex: i,
          vp,
          imageUrl,
          checkboxes: checkboxList,
          fields: textFields
        });
  
        allFieldData.push({ pageIndex: i, fields: textFields, checkboxes: checkboxList });
      }
  
      setPdfDoc(pdf);
      setPages(pageCanvases);
      setAllFields(allFieldData);
      setCheckboxes(allCheckboxes);
      setIsRendering(false);
    } catch (err) {
      console.error('Error loading PDF:', err);
      alert('Failed to load PDF');
      setIsRendering(false);
    }
  };
  
  
  const redrawOverlay = async (canvas, pdfBytes, viewport, cbList, fieldList) => {
    if (!canvas || !pdfBytes || !viewport) return;

    const context = canvas.getContext('2d');
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const page = await pdf.getPage(1);

    await page.render({ canvasContext: context, viewport }).promise;

    cbList.forEach((cb) => {
      context.strokeStyle = 'red';
      context.strokeRect(cb.x, cb.y, cb.width, cb.height);
      if (cb.checked) {
        context.fillStyle = 'green';
        context.font = `${cb.height}px Helvetica`;
        context.fillText('✓', cb.x + 3, cb.y + cb.height - 4);
      }
    });

    fieldList.forEach((field) => {
      context.strokeStyle = 'blue';
      context.strokeRect(field.x, field.y, field.width, field.height);
      if (field.value) {
        context.fillStyle = 'blue';
        context.font = `${Math.min(field.height - 2, 14)}px Helvetica`;
        context.fillText(field.value, field.x + 2, field.y + field.height - 4);
      }
    });
  };

  useEffect(() => {
    if (!viewport || !pdfBytes || !pdfContainerRef.current) return;
  
    const canvases = pdfContainerRef.current.querySelectorAll('canvas');
    const listeners = [];
  
    const handleClick = (e, canvasIndex) => {
      const canvas = canvases[canvasIndex];
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (viewport.width / canvas.width);
      const y = (e.clientY - rect.top) * (viewport.height / canvas.height);
  
      const currentFields = allFields[canvasIndex]?.fields || [];
      const currentCheckboxes = allFields[canvasIndex]?.checkboxes || [];
  
      const cbIndex = currentCheckboxes.findIndex(
        cb => x >= cb.x && x <= cb.x + cb.width && y >= cb.y && y <= cb.y + cb.height
      );
  
      if (cbIndex !== -1) {
        const updated = [...currentCheckboxes];
        updated[cbIndex].checked = !updated[cbIndex].checked;
  
        const newAllFields = [...allFields];
        newAllFields[canvasIndex].checkboxes = updated;
        setAllFields(newAllFields);
  
        redrawOverlay(canvas, pdfBytes, viewport, updated, currentFields);
        return;
      }
  
      const fieldIndex = currentFields.findIndex(
        f => x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height
      );
  
      if (fieldIndex !== -1) {
        const value = prompt('Enter text:');
        if (!value) return;
  
        const updated = [...currentFields];
        updated[fieldIndex].value = value;
  
        const newAllFields = [...allFields];
        newAllFields[canvasIndex].fields = updated;
        setAllFields(newAllFields);
  
        redrawOverlay(canvas, pdfBytes, viewport, currentCheckboxes, updated);
      }
    };
  
    // Attach listeners
    canvases.forEach((canvas, i) => {
      const listener = (e) => handleClick(e, i);
      canvas.addEventListener('click', listener);
      listeners.push({ canvas, listener });
    });
  
    // ✅ Cleanup all listeners on unmount or re-render
    return () => {
      listeners.forEach(({ canvas, listener }) => {
        canvas.removeEventListener('click', listener);
      });
    };
  }, [viewport, pdfBytes, allFields]);
  
  const togglePDF = () => {
    if (isRendering) return;
  
    if (pdfVisible) {
      const container = pdfContainerRef.current;
      if (container) {
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
      }
  
      setFields([]);
      setCheckboxes([]);
      setAllFields([]); // If you're using per-page field states
      setViewport(null);
      setPdfDoc(null);
      setPages([]);
    } else {
      loadPDF();
    }
  
    setPdfVisible(!pdfVisible);
  };
  

  const saveOrDownload = async (isDownload = false) => {
    if (!pdfBytes || !pages || pages.length === 0) {
      alert("PDF not loaded properly.");
      return;
    }
  
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);
  
      let customFont;
      try {
        const fontBytes = await fetch('/fonts/DejaVuSans.ttf').then(res => res.arrayBuffer());
        customFont = await pdfDoc.embedFont(fontBytes);
      } catch (err) {
        console.warn("Custom font failed to load. Falling back to Helvetica.", err);
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
  
      const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
      pages.forEach((page, pageIndex) => {
        const pdfPage = pdfDoc.getPages()[pageIndex];
        const { vp, fields = [], checkboxes = [] } = page;
  
        if (!vp) {
          console.warn(`Viewport missing for page ${pageIndex}`);
          return;
        }
  
        const pdfWidth = pdfPage.getWidth();
        const pdfHeight = pdfPage.getHeight();
        const scaleX = pdfWidth / vp.width;
        const scaleY = pdfHeight / vp.height;
        const form = pdfDoc.getForm();
  
        // Draw text fields
        fields.forEach(({ x, y, width: w, height: h, value }) => {
          if (!value) return;
        
          const adjustedX = x * scaleX;
          const adjustedY = pdfHeight - (y * scaleY);
        
          // Manually adjust text vertically based on height
          console.log(h);
          const verticalShift = h > 50 ? 30 : h > 40 ? 23 : 12; // tweak this for better alignment, niche namanor jonno barao
        
          pdfPage.drawText(value, {
            x: adjustedX + 2,
            y: adjustedY - verticalShift,
            size: 11, // fixed size
            font: defaultFont,
            color: rgb(0, 0, 0),
            opacity: 1,
          });
        });
        
        
        
  
        // Draw checkbox ✓
        checkboxes.forEach(({ x, y, width: w, height: h, checked }) => {
          if (!checked) return;
  
          const adjustedX = x * scaleX;
          const adjustedY = pdfHeight - (y * scaleY) - h + 4; // vertical tweak
  
          pdfPage.drawText('✓', {
            x: adjustedX,
            y: adjustedY,
            size: 35,
            font: customFont,
            color: rgb(0, 0.5, 0),
            opacity: 1,
          });
        });
      });
  
      const updatedPdf = await pdfDoc.save();
      const blob = new Blob([updatedPdf], { type: 'application/pdf' });
  
      if (isDownload) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const formData = new FormData();
        formData.append('file', blob, 'filled.pdf');
  
        const response = await fetch('http://localhost:3000/pdf/save', {
          method: 'POST',
          body: formData,
        });
  
        if (response.ok) {
          alert('PDF saved to server!');
        } else {
          alert('Failed to save PDF on server.');
        }
      }
    } catch (err) {
      console.error("Error saving/downloading PDF:", err);
      alert("Something went wrong while processing the PDF.");
    }
  };
  

  return ( 
    <div style={{ 
      maxWidth: '900px', 
      margin: '40px auto', 
      padding: '20px', 
      borderRadius: '12px', 
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', 
      backgroundColor: '#fff' 
    }}>
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: '600', 
        marginBottom: '20px', 
        color: '#2c3e50' 
      }}>
        Edit PDF
      </h2>
    
      {/* Button Row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <button 
          onClick={togglePDF} 
          disabled={isRendering} 
          style={{
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isRendering ? 'not-allowed' : 'pointer',
            opacity: isRendering ? 0.6 : 1,
            fontSize: '14px'
          }}
        >
          {pdfVisible ? 'Unload PDF' : 'Load PDF'}
        </button>
    
        <button 
          onClick={() => saveOrDownload(false)} 
          disabled={!pdfVisible}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2ecc71',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: !pdfVisible ? 'not-allowed' : 'pointer',
            opacity: !pdfVisible ? 0.6 : 1,
            fontSize: '14px'
          }}
        >
          Save PDF
        </button>
    
        <button 
          onClick={() => saveOrDownload(true)} 
          disabled={!pdfVisible}
          style={{
            padding: '10px 20px',
            backgroundColor: '#e67e22',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: !pdfVisible ? 'not-allowed' : 'pointer',
            opacity: !pdfVisible ? 0.6 : 1,
            fontSize: '14px'
          }}
        >
          Download PDF
        </button>
      </div>
    
      {/* Canvas Area */}
      <div
  ref={pdfContainerRef}
  style={{
    overflowX: 'auto',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: '#f9f9f9'
  }}
>
  {pages.map((page, idx) => (
    <div key={idx} style={{ position: 'relative', marginBottom: '20px' }}>
      <img 
        src={page.imageUrl} 
        alt={`Page ${idx + 1}`} 
        style={{ width: page.vp.width, height: page.vp.height }} 
      />

      {/* Overlay Example */}
      {page.checkboxes.map((cb, cbIndex) => (
  <div
    key={`cb-${cbIndex}`}
    onClick={() => {
      const updatedPages = [...pages];
      updatedPages[idx].checkboxes[cbIndex].checked = !updatedPages[idx].checkboxes[cbIndex].checked;
      setPages(updatedPages);
    }}
    style={{
      position: 'absolute',
      top: cb.y,
      left: cb.x,
      width: cb.width,
      height: cb.height,
      backgroundColor: 'rgba(255,255,255,0)',
      border: '1px solid #000',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${cb.height - 2}px`,
      color: 'green',
      fontWeight: 'bold'
    }}
  >
    {cb.checked ? '✓' : ''}
  </div>
))}

      {page.fields.map((field, i) => (
        <input
          key={`text-${i}`}
          type="text"
          value={field.value}
          style={{
            position: 'absolute',
            top: field.y,
            left: field.x,
            width: field.width,
            height: field.height,
            background: 'rgba(255,255,255,0)',
            border: '1px solid #ccc',
            padding: '4px',
            fontSize: '12px'
          }}
          onChange={(e) => {
            const updatedPages = [...pages];
            updatedPages[idx].fields[i].value = e.target.value;
            setPages(updatedPages);
          }}
        />
      ))}
    </div>
  ))}
</div>



    </div>  
    );  
  }
export default App;
