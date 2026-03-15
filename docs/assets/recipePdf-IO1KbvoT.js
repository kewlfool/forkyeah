const a=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<title>{{documentTitle}}</title>

<style>
body {
  font-family: Georgia, "Times New Roman", serif;
  background: #f6f7f9;
  margin: 0;
  padding: 40px;
  color: #1e2430;
}

.recipe {
  max-width: 800px;
  margin: auto;
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

h1 {
  margin: 0 0 10px;
  font-size: 36px;
}

.description {
  margin: 0 0 14px;
  color: #374151;
  font-size: 15px;
  line-height: 1.5;
}

.meta {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 20px;
}

.tags {
  margin-top: 4px;
}

.image {
  margin: 0 0 30px;
}

.image img {
  max-width: 100%;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 6px;
}

.time-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 30px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 6px;
}

.time-box {
  text-align: center;
}

.time-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #6b7280;
}

.time-value {
  font-size: 20px;
  font-weight: bold;
}

.section {
  margin-top: 30px;
}

.section h2 {
  font-size: 14px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 6px;
  margin-bottom: 14px;
}

.ingredients {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 40px;
}

.ingredients li {
  margin-bottom: 6px;
  break-inside: avoid;
}

.steps li {
  margin-bottom: 10px;
  break-inside: avoid;
}

.notes {
  background: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
}

.nutrients li {
  margin-bottom: 4px;
}

.muted-empty {
  color: #6b7280;
  font-style: italic;
}

.recipe-footer-meta {
  display: grid;
  gap: 10px;
  margin-top: 30px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.footer-meta-item {
  display: grid;
  gap: 4px;
}

.footer-meta-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
}

.footer-meta-value {
  font-size: 14px;
  line-height: 1.5;
  color: #1e2430;
  overflow-wrap: anywhere;
}

@media print {
  body {
    background: white;
    padding: 0;
  }

  .recipe {
    box-shadow: none;
    border-radius: 0;
    padding: 20px;
  }
}

@media (max-width: 720px) {
  .ingredients {
    grid-template-columns: 1fr;
  }
}
</style>

</head>

<body>

<div class="recipe">

<h1>{{title}}</h1>
{{descriptionBlock}}

<div class="meta">
  {{tagsBlock}}
</div>

<div class="time-grid">
  <div class="time-box">
    <div class="time-label">Prep</div>
    <div class="time-value">{{prepTime}}</div>
  </div>

  <div class="time-box">
    <div class="time-label">Cook</div>
    <div class="time-value">{{cookTime}}</div>
  </div>
</div>

{{imageBlock}}

<div class="section">
  <h2>Ingredients</h2>
  <ul class="ingredients">
{{ingredients}}
  </ul>
</div>

<div class="section">
<h2>Steps</h2>
<ol class="steps">
{{steps}}
</ol>
</div>

<div class="section">
<h2>Notes</h2>
<div class="notes">
{{notes}}
</div>
</div>

{{nutrientsSection}}

{{footerMetaBlock}}

</div>

{{printScript}}

</body>
</html>
`,i=n=>n.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),s=(n,e="None")=>n.length?n.map(t=>`<li>${i(t)}</li>`).join(`
`):`<li class="muted-empty">${i(e)}</li>`,d=n=>n.trim()?`<p class="description">${i(n.trim())}</p>`:"",l=n=>n.length?`<div class="tags">${i(n.join(" • "))}</div>`:"",p=(n,e)=>e!=null&&e.trim()?['<div class="image">',`  <img src="${i(e.trim())}" alt="${i(n)}" />`,"</div>"].join(`
`):"",c=n=>n.length?['<div class="section">',"<h2>Nutrients</h2>",'<ul class="nutrients">',s(n),"</ul>","</div>"].join(`
`):"",m=(n,e)=>{const t=n.trim(),o=e.trim();if(!t&&!o)return"";const r=[];return t&&r.push(['<div class="footer-meta-item">','  <span class="footer-meta-label">Author</span>',`  <span class="footer-meta-value">${i(t)}</span>`,"</div>"].join(`
`)),o&&r.push(['<div class="footer-meta-item">','  <span class="footer-meta-label">Source</span>',`  <span class="footer-meta-value">${i(o)}</span>`,"</div>"].join(`
`)),['<div class="recipe-footer-meta">',...r,"</div>"].join(`
`)},g=`<script>
(function () {
  const triggerPrint = () => {
    window.setTimeout(() => {
      window.focus();
      window.print();
    }, 60);
  };

  const start = () => {
    const images = Array.from(document.images);
    let pending = 0;

    const markReady = () => {
      pending -= 1;
      if (pending <= 0) {
        triggerPrint();
      }
    };

    for (const image of images) {
      if (image.complete) {
        continue;
      }

      pending += 1;
      image.addEventListener('load', markReady, { once: true });
      image.addEventListener('error', markReady, { once: true });
    }

    if (pending === 0) {
      triggerPrint();
    }
  };

  window.addEventListener('load', start, { once: true });
  window.addEventListener('afterprint', () => {
    window.setTimeout(() => window.close(), 120);
  }, { once: true });
})();
<\/script>`,u=(n,e)=>{let t=n;for(const[o,r]of Object.entries(e))t=t.replaceAll(`{{${o}}}`,r);return t},f=n=>{var t,o,r;const e=n.title.trim()||"Untitled recipe";return u(a,{documentTitle:i(e),title:i(e),descriptionBlock:d(n.description??""),tagsBlock:l(n.tags??[]),imageBlock:p(e,n.imageUrl),prepTime:i(((t=n.prepTime)==null?void 0:t.trim())||"—"),cookTime:i(((o=n.cookTime)==null?void 0:o.trim())||"—"),ingredients:s(n.ingredients??[]),steps:s(n.steps??[]),notes:(r=n.notes)!=null&&r.trim()?i(n.notes.trim()):'<p class="muted-empty">None</p>',nutrientsSection:c(n.nutrients??[]),footerMetaBlock:m(n.author??"",n.source??""),printScript:g})},x=n=>{try{const e=f(n),t=window.open("","_blank","width=960,height=1200");if(!t){console.error("Recipe export window was blocked");return}t.document.open(),t.document.write(e),t.document.close()}catch(e){console.error("Recipe export failed",e)}};export{f as buildRecipeExportHtml,x as exportRecipeToPdf};
