const SAMPLES = {
  js: `function getData(url) {
  var data;
  var x = new XMLHttpRequest();
  x.open('GET', url, false);
  x.send();
  if (x.status == 200) {
    data = JSON.parse(x.responseText);
  }
  return data;
}

function processUsers(users) {
  var result = [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].age > 18) {
      result.push(users[i].name + ' ' + users[i].email);
    }
  }
  return result;
}`,
  python: `def calculate(a, b, op):
    if op == 'add':
        return a + b
    elif op == 'sub':
        return a - b
    elif op == 'mul':
        return a * b
    elif op == 'div':
        return a / b

def get_user_data(id):
    import requests
    r = requests.get('https://api.example.com/users/' + str(id))
    data = r.json()
    n = data['name']
    e = data['email']
    a = data['age']
    return n, e, a`,
  react: `function UserList(props) {
  const [data, setData] = React.useState([]);

  React.useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => {
      setData(d);
    });
  });

  return (
    <div>
      {data.map((u, i) => (
        <div key={i}>
          <p>{u.name}</p>
          <p>{u.email}</p>
        </div>
      ))}
    </div>
  );
}`,
  ts: `interface User {
  n: string,
  e: string,
  a: number,
  d: string
}

async function fetchAndProcess(id) {
  try {
    const res = await fetch('/api/user/' + id);
    const u = await res.json();
    let str = '';
    str = str + 'Name: ' + u.n;
    str = str + ' Email: ' + u.e;
    str = str + ' Age: ' + u.a;
    return str;
  } catch(e) {
    console.log(e);
  }
}`,
};

const LANG_MAP = {
  js: "JavaScript",
  python: "Python",
  react: "React (JSX)",
  ts: "TypeScript",
};

function loadSample(key) {
  document.getElementById("code-input").value = SAMPLES[key];
  document.getElementById("lang-sel").value = LANG_MAP[key];
}

function toggleKey() {
  const inp = document.getElementById("api-key");
  const icon = document.getElementById("eye-icon");
  if (inp.type === "password") {
    inp.type = "text";
    icon.className = "ti ti-eye-off";
  } else {
    inp.type = "password";
    icon.className = "ti ti-eye";
  }
}

function scoreClass(v) {
  if (v >= 8) return { text: "c-green", fill: "f-green" };
  if (v >= 5) return { text: "c-amber", fill: "f-amber" };
  return { text: "c-red", fill: "f-red" };
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function runReview() {
  const code = document.getElementById("code-input").value.trim();
  const apiKey = document.getElementById("api-key").value.trim();
  const lang = document.getElementById("lang-sel").value;

  document.getElementById("error-area").innerHTML = "";
  document.getElementById("results-area").innerHTML = "";

  if (!code) {
    showError("Please paste some code first.");
    return;
  }
  if (!apiKey.startsWith("sk-")) {
    showError("Please enter a valid Anthropic API key starting with sk-ant-…");
    return;
  }

  const btn = document.getElementById("review-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Reviewing…';

  const langLabel = lang === "auto" ? "" : ` (${lang})`;
  const prompt = `You are a senior software engineer doing a concise, structured code review.

Analyze this${langLabel} code and respond ONLY with a valid JSON object — no markdown, no backticks, no extra text.

Code:
\`\`\`
${code}
\`\`\`

Return this exact JSON shape:
{
  "summary": "2-3 sentence overall assessment",
  "scores": {
    "readability": <integer 1-10>,
    "structure": <integer 1-10>,
    "maintainability": <integer 1-10>
  },
  "improvements": [
    {"title": "...", "description": "...", "example": "optional short code fix or null"},
    {"title": "...", "description": "...", "example": "optional short code fix or null"},
    {"title": "...", "description": "...", "example": "optional short code fix or null"}
  ],
  "positive": {"title": "...", "description": "..."}
}

Rules:
- improvements must have exactly 3 items
- Be specific and actionable, referencing actual lines/patterns from the code
- example: short corrected snippet (≤4 lines) or null
- No extra keys`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const raw = data.content.map((b) => b.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const review = JSON.parse(clean);
    renderResults(review);
  } catch (err) {
    showError("Review failed: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-wand"></i> Review Code';
  }
}

function showError(msg) {
  document.getElementById("error-area").innerHTML =
    `<div class="error-box"><i class="ti ti-alert-circle" style="margin-right:6px"></i>${esc(msg)}</div>`;
}

function renderResults(r) {
  const s = r.scores;
  const avg =
    Math.round(((s.readability + s.structure + s.maintainability) / 3) * 10) /
    10;
  const avgC = scoreClass(avg);

  let html = `
    <p class="section-heading">Quality Scores</p>
    <div class="scores-grid">
      <div class="score-card">
        <div class="score-label">Overall</div>
        <div class="score-val ${avgC.text}">${avg}<span class="score-denom">/10</span></div>
        <div class="score-bar"><div class="score-fill ${avgC.fill}" style="width:${avg * 10}%"></div></div>
      </div>`;

  [
    ["readability", "Readability"],
    ["structure", "Structure"],
    ["maintainability", "Maintainability"],
  ].forEach(([k, label]) => {
    const v = s[k];
    const c = scoreClass(v);
    html += `<div class="score-card">
      <div class="score-label">${label}</div>
      <div class="score-val ${c.text}">${v}<span class="score-denom">/10</span></div>
      <div class="score-bar"><div class="score-fill ${c.fill}" style="width:${v * 10}%"></div></div>
    </div>`;
  });

  html += `</div>
    <div class="summary-box">${esc(r.summary)}</div>
    <div class="divider"></div>
    <p class="section-heading">Review</p>
    <div class="review-cards">`;

  r.improvements.forEach((item, i) => {
    html += `<div class="rcard">
      <div class="rcard-top">
        <span class="badge badge-imp">Improvement ${i + 1}</span>
        <span class="rcard-title">${esc(item.title)}</span>
      </div>
      <p class="rcard-desc">${esc(item.description)}</p>
      ${item.example ? `<div class="code-block">${esc(item.example)}</div>` : ""}
    </div>`;
  });

  html += `<div class="rcard positive">
    <div class="rcard-top">
      <span class="badge badge-pos"><i class="ti ti-thumb-up" style="font-size:11px;margin-right:3px"></i>Positive note</span>
      <span class="rcard-title">${esc(r.positive.title)}</span>
    </div>
    <p class="rcard-desc">${esc(r.positive.description)}</p>
  </div>`;

  html += "</div>";
  document.getElementById("results-area").innerHTML = html;
}

loadSample("js");
