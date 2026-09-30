from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import csv, io, json, os

app = FastAPI(title='WorkTrace API', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'tasks.csv')

class Task(BaseModel):
    id: str
    title: str
    owner: str
    status: str
    priority: str = 'Medium'
    deadline: str
    depends_on: Optional[str] = ''
    last_update: str = ''
    description: str = ''

class AnalyzeRequest(BaseModel):
    tasks: List[Task]


def load_tasks():
    with open(DATA_FILE, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def parse_dt(v):
    try: return datetime.fromisoformat(v)
    except: return None


def analyze(tasks):
    now = datetime.now()
    by_id = {t.id: t for t in tasks}
    children = {t.id: [] for t in tasks}
    for t in tasks:
        if t.depends_on and t.depends_on in children:
            children[t.depends_on].append(t.id)

    findings=[]
    for t in tasks:
        deadline=parse_dt(t.deadline)
        last=parse_dt(t.last_update)
        downstream=[]
        stack=list(children.get(t.id, []))
        seen=set()
        while stack:
            x=stack.pop()
            if x in seen: continue
            seen.add(x); downstream.append(x); stack.extend(children.get(x, []))
        blocked_children=[by_id[x] for x in children.get(t.id, []) if by_id[x].status.lower() in {'blocked','waiting','pending'}]
        stale_hours=(now-last).total_seconds()/3600 if last else 0
        overdue=bool(deadline and deadline < now and t.status.lower() not in {'completed','done'})
        score=0
        reasons=[]
        if t.status.lower() in {'blocked','waiting','pending'}: score += 35; reasons.append('task is blocked or waiting')
        if overdue: score += 30; reasons.append('deadline has passed')
        if stale_hours > 24: score += 20; reasons.append(f'no update for {round(stale_hours)} hours')
        if downstream: score += min(30, len(downstream)*10); reasons.append(f'blocks {len(downstream)} downstream task(s)')
        if t.priority.lower()=='high': score += 10; reasons.append('high priority')
        if blocked_children: score += 15; reasons.append(f'{len(blocked_children)} immediate dependent task(s) are blocked')
        if score >= 50:
            risk='Critical' if score>=80 else 'High' if score>=60 else 'Medium'
            action=f"Resolve '{t.title}' first and update {t.owner}."
            if blocked_children: action += f" Unblock {', '.join(x.title for x in blocked_children[:2])}."
            findings.append({'task_id':t.id,'task':t.title,'owner':t.owner,'risk':risk,'score':min(score,100),'root_cause': reasons[0] if reasons else 'workflow dependency','reasons':reasons,'downstream_count':len(downstream),'downstream_tasks':[by_id[x].title for x in downstream],'recommended_action':action})
    findings.sort(key=lambda x:x['score'], reverse=True)
    blocked=sum(1 for t in tasks if t.status.lower() in {'blocked','waiting','pending'})
    completed=sum(1 for t in tasks if t.status.lower() in {'completed','done'})
    overdue=sum(1 for t in tasks if (parse_dt(t.deadline) and parse_dt(t.deadline)<now and t.status.lower() not in {'completed','done'}))
    return {'summary':{'total_tasks':len(tasks),'completed':completed,'blocked':blocked,'overdue':overdue,'health':'At Risk' if findings else 'On Track'},'findings':findings,'graph':{'nodes':[{'id':t.id,'label':t.title,'status':t.status,'owner':t.owner} for t in tasks],'edges':[{'from':t.depends_on,'to':t.id} for t in tasks if t.depends_on and t.depends_on in by_id]}}

@app.get('/api/health')
def health(): return {'status':'ok','service':'WorkTrace API'}

@app.get('/api/tasks')
def tasks(): return load_tasks()

@app.post('/api/analyze')
def analyze_api(req: AnalyzeRequest): return analyze(req.tasks)

@app.post('/api/analyze/demo')
def demo(): return analyze([Task(**x) for x in load_tasks()])

@app.post('/api/tasks/import')
def import_csv(payload: dict):
    content=payload.get('csv','')
    if not content: raise HTTPException(400,'CSV content is required')
    rows=list(csv.DictReader(io.StringIO(content)))
    required={'id','title','owner','status','priority','deadline','depends_on','last_update','description'}
    if not rows or not required.issubset(rows[0].keys()): raise HTTPException(400,'CSV headers must be: '+','.join(sorted(required)))
    return analyze([Task(**r) for r in rows])

@app.get('/api/sample-csv')
def sample_csv():
    return {'csv':open(DATA_FILE,encoding='utf-8').read()}
