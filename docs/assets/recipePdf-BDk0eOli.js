const c=`<!DOCTYPE html>
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
  columns: 2;
  column-gap: 40px;
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
    columns: 1;
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

</div>

{{printScript}}

</body>
</html>
`,t=n=>n.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),d=(n,e="None")=>n.length?n.map(i=>`<li>${t(i)}</li>`).join(`
`):`<li class="muted-empty">${t(e)}</li>`,l=n=>n.trim()?`<p class="description">${t(n.trim())}</p>`:"",p=n=>n.length?`<div class="tags">${t(n.join(" • "))}</div>`:"",m=(n,e)=>e!=null&&e.trim()?['<div class="image">',`  <img src="${t(e.trim())}" alt="${t(n)}" />`,"</div>"].join(`
`):"",g=n=>n.length?['<div class="section">',"<h2>Nutrients</h2>",'<ul class="nutrients">',d(n),"</ul>","</div>"].join(`
`):"",u=`<script>
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
<\/script>`,x=(n,e)=>{let i=n;for(const[r,o]of Object.entries(e))i=i.replaceAll(`{{${r}}}`,o);return i},b=n=>{var e,i,r;try{const o=n.title.trim()||"Untitled recipe",a=x(c,{documentTitle:t(o),title:t(o),descriptionBlock:l(n.description??""),tagsBlock:p(n.tags??[]),imageBlock:m(o,n.imageUrl),prepTime:t(((e=n.prepTime)==null?void 0:e.trim())||"—"),cookTime:t(((i=n.cookTime)==null?void 0:i.trim())||"—"),ingredients:d(n.ingredients??[]),steps:d(n.steps??[]),notes:(r=n.notes)!=null&&r.trim()?t(n.notes.trim()):'<p class="muted-empty">None</p>',nutrientsSection:g(n.nutrients??[]),printScript:u}),s=window.open("","_blank","width=960,height=1200");if(!s){console.error("Recipe export window was blocked");return}s.document.open(),s.document.write(a),s.document.close()}catch(o){console.error("Recipe export failed",o)}};export{b as exportRecipeToPdf};
