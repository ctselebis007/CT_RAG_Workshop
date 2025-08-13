CT_RAG_Workshop

We will leverage the following to build a RAG App do ingest files (PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, PPTX) and allow the user to ask Questions in a Q&A.
- MongoDB Atlas as a Database Store & Vector store
- OpenAI as embedding model and LLM
- VoyageAI as an embedding model option
- Langchain as LLM framework



After cloning the repo

1. Create a virtual environment:

    python3 -m venv myenv
    
    source myenv/bin/activate

2. Install dependecies

    npm install

3. Run both front & back dev environment

    npm run dev:full
