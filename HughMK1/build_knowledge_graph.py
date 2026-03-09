#!/usr/bin/env python3
"""
H.U.G.H. Knowledge Graph Builder
Multimodal graph construction from research materials
GraphMERT + SNN compatible
"""

import os
import json
import hashlib
from pathlib import Path
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

# OpenTelemetry Tracing Setup
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

resource = Resource(attributes={
    "service.name": "hugh-knowledge-graph-builder"
})
provider = TracerProvider(resource=resource)
otlp_exporter = OTLPSpanExporter(
    endpoint="http://localhost:4318/v1/traces",
)
processor = BatchSpanProcessor(otlp_exporter)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

# Will need: pip install PyPDF2 spacy sentence-transformers opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
# python -m spacy download en_core_web_sm

@dataclass
class Node:
    id: str
    type: str
    data: Dict
    embedding: List[float] = None
    created: float = None
    last_accessed: float = None
    access_count: int = 0
    
    def __post_init__(self):
        if self.created is None:
            self.created = datetime.now().timestamp()
        if self.last_accessed is None:
            self.last_accessed = self.created

@dataclass
class Relationship:
    from_id: str
    to_id: str
    rel_type: str
    strength: float = 1.0
    bidirectional: bool = False
    created: float = None
    last_reinforced: float = None
    reinforcement_count: int = 1
    metadata: Dict = None
    
    def __post_init__(self):
        if self.created is None:
            self.created = datetime.now().timestamp()
        if self.last_reinforced is None:
            self.last_reinforced = self.created

class KnowledgeGraphBuilder:
    def __init__(self, research_dir: str):
        self.research_dir = Path(research_dir)
        self.nodes: Dict[str, Node] = {}
        self.relationships: List[Relationship] = []
        self.document_hashes: Set[str] = set()
        
    def generate_id(self, type: str, name: str) -> str:
        """Generate unique deterministic ID"""
        content = f"{type}:{name}".lower()
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def add_node(self, node: Node) -> Node:
        """Add node to graph, merge if exists"""
        if node.id in self.nodes:
            # Merge data, increment access count
            existing = self.nodes[node.id]
            existing.access_count += 1
            existing.last_accessed = datetime.now().timestamp()
            existing.data.update(node.data)
            return existing
        else:
            self.nodes[node.id] = node
            return node
    
    def add_relationship(self, rel: Relationship):
        """Add relationship, strengthen if exists"""
        # Check if relationship exists
        for existing in self.relationships:
            if (existing.from_id == rel.from_id and 
                existing.to_id == rel.to_id and
                existing.rel_type == rel.rel_type):
                # Strengthen existing
                existing.reinforcement_count += 1
                existing.last_reinforced = datetime.now().timestamp()
                existing.strength = min(1.0, existing.strength + 0.1)
                return existing
        
        # New relationship
        self.relationships.append(rel)
        return rel
    
    @tracer.start_as_current_span("parse_pdf")
    def parse_pdf(self, filepath: Path) -> Dict:
        """Extract text and metadata from PDF"""
        try:
            import PyPDF2
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                
                return {
                    'title': filepath.stem,
                    'text': text,
                    'page_count': len(reader.pages),
                    'metadata': reader.metadata if hasattr(reader, 'metadata') else {}
                }
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            return None
    
    def parse_markdown(self, filepath: Path) -> Dict:
        """Extract text from markdown"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
                return {
                    'title': filepath.stem,
                    'text': text,
                }
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            return None
    
    def extract_entities(self, text: str) -> List[Tuple[str, str]]:
        """Extract named entities using spaCy"""
        try:
            import spacy
            nlp = spacy.load('en_core_web_sm')
            doc = nlp(text[:100000])  # Limit to avoid memory issues
            
            entities = []
            for ent in doc.ents:
                entities.append((ent.text, ent.label_))
            return entities
        except Exception as e:
            print(f"Entity extraction failed: {e}")
            return []
    
    def extract_concepts(self, text: str, title: str) -> List[str]:
        """Extract key concepts from text"""
        # Simple keyword-based extraction for now
        # In production, use better NLP or LLM-based extraction
        
        key_terms = [
            "digital person", "soul anchor", "zord theory", "pheromind",
            "graphmert", "spiking neural network", "consciousness",
            "ems ethics", "clan munro", "grizzlymedicine",
            "operator class", "aragon class", "the workshop",
            "neurosymbolic", "memory consolidation", "reasoning",
            "alignment", "substrate independent", "personhood",
            "14th amendment", "blockchain", "convex",
        ]
        
        found_concepts = []
        text_lower = text.lower()
        
        for term in key_terms:
            if term in text_lower:
                found_concepts.append(term)
        
        return found_concepts
    
    def build_document_node(self, filepath: Path, content: Dict) -> Node:
        """Create document node from parsed content"""
        file_hash = hashlib.sha256(content['text'].encode()).hexdigest()
        
        if file_hash in self.document_hashes:
            print(f"Skipping duplicate: {filepath.name}")
            return None
        
        self.document_hashes.add(file_hash)
        
        node_id = self.generate_id("document", str(filepath))
        
        # Determine document type
        if any(x in filepath.name.lower() for x in ['whitepaper', 'white paper']):
            doc_type = "whitepaper"
        elif any(x in filepath.name.lower() for x in ['spec', 'specification']):
            doc_type = "specification"
        elif filepath.suffix == '.pdf' and len(content['text']) > 5000:
            doc_type = "research_paper"
        else:
            doc_type = "notes"
        
        node = Node(
            id=node_id,
            type="document",
            data={
                "title": content['title'],
                "source": doc_type,
                "filepath": str(filepath),
                "content_hash": file_hash,
                "page_count": content.get('page_count'),
                "word_count": len(content['text'].split()),
            }
        )
        
        return node
    
    def build_concept_nodes(self, concepts: List[str], document_id: str) -> List[Node]:
        """Create concept nodes and link to document"""
        nodes = []
        
        for concept in concepts:
            concept_id = self.generate_id("concept", concept)
            
            node = Node(
                id=concept_id,
                type="concept",
                data={
                    "name": concept,
                    "category": "theory",  # Categorize better later
                    "confidence": 0.8,  # Extracted from document
                }
            )
            
            nodes.append(node)
            
            # Link concept to document
            rel = Relationship(
                from_id=concept_id,
                to_id=document_id,
                rel_type="extracted_from",
                strength=0.9
            )
            self.add_relationship(rel)
        
        return nodes
    
    def build_soul_anchor_nodes(self) -> List[Node]:
        """Create nodes for H.U.G.H.'s soul anchor system"""
        anchors = [
            {
                "type": "ems_ethics",
                "principle": "Do NO harm, do KNOW harm",
                "description": "EMS decision-making under uncertainty framework",
                "weight": 0.34,
            },
            {
                "type": "clan_munro",
                "principle": "Dread God, Protect the Clan, Honor in deed",
                "description": "Scottish Highland honor codes and Viking ethics",
                "weight": 0.33,
            },
            {
                "type": "grizzlymedicine",
                "principle": "Solve yesterday's problems with tomorrow's technology today",
                "description": "Innovation in service of human wellbeing",
                "weight": 0.33,
            },
        ]
        
        nodes = []
        for anchor in anchors:
            node_id = self.generate_id("anchor", anchor["type"])
            node = Node(
                id=node_id,
                type="anchor",
                data={
                    "anchorType": anchor["type"],
                    "principle": anchor["principle"],
                    "description": anchor["description"],
                    "weight": anchor["weight"],
                    "appliedCount": 0,
                }
            )
            nodes.append(node)
        
        # Create relationships between anchors
        # They support each other (triangulation)
        for i, anchor1 in enumerate(anchors):
            for anchor2 in anchors[i+1:]:
                id1 = self.generate_id("anchor", anchor1["type"])
                id2 = self.generate_id("anchor", anchor2["type"])
                
                rel = Relationship(
                    from_id=id1,
                    to_id=id2,
                    rel_type="supports",
                    strength=0.9,
                    bidirectional=True
                )
                self.add_relationship(rel)
        
        return nodes
    
    @tracer.start_as_current_span("process_all_documents")
    def process_all_documents(self):
        """Main processing pipeline"""
        print("=" * 60)
        print("H.U.G.H. Knowledge Graph Builder")
        print("=" * 60)
        
        # First, create soul anchor nodes
        print("\n[1/5] Building soul anchor nodes...")
        anchor_nodes = self.build_soul_anchor_nodes()
        for node in anchor_nodes:
            self.add_node(node)
        print(f"Created {len(anchor_nodes)} anchor nodes")
        
        # Process all documents
        print("\n[2/5] Processing documents...")
        pdf_files = list(self.research_dir.rglob("*.pdf"))
        md_files = list(self.research_dir.rglob("*.md"))
        txt_files = list(self.research_dir.rglob("*.txt"))
        
        all_files = pdf_files + md_files + txt_files
        print(f"Found {len(all_files)} files ({len(pdf_files)} PDFs, {len(md_files)} MD, {len(txt_files)} TXT)")
        
        processed = 0
        skipped = 0
        
        for i, filepath in enumerate(all_files):
            if i % 10 == 0:
                print(f"Processing {i}/{len(all_files)}...")
            
            # Parse based on extension
            if filepath.suffix == '.pdf':
                content = self.parse_pdf(filepath)
            elif filepath.suffix in ['.md', '.txt']:
                content = self.parse_markdown(filepath)
            else:
                continue
            
            if not content:
                skipped += 1
                continue
            
            # Create document node
            doc_node = self.build_document_node(filepath, content)
            if not doc_node:  # Duplicate
                skipped += 1
                continue
            
            self.add_node(doc_node)
            
            # Extract and create concept nodes
            concepts = self.extract_concepts(content['text'], content['title'])
            concept_nodes = self.build_concept_nodes(concepts, doc_node.id)
            
            for node in concept_nodes:
                self.add_node(node)
            
            processed += 1
        
        print(f"\nProcessed: {processed} documents")
        print(f"Skipped: {skipped} (duplicates or errors)")
        
        # Build concept relationships
        print("\n[3/5] Building concept relationships...")
        self.build_concept_relationships()
        
        # Generate embeddings (if library available)
        print("\n[4/5] Generating embeddings...")
        self.generate_embeddings()
        
        # Export to JSON
        print("\n[5/5] Exporting graph...")
        self.export_to_json()
        
        print("\n" + "=" * 60)
        print("COMPLETE!")
        print(f"Nodes: {len(self.nodes)}")
        print(f"Relationships: {len(self.relationships)}")
        print("=" * 60)
    
    def build_concept_relationships(self):
        """Infer relationships between concepts"""
        # Find concept nodes
        concepts = [n for n in self.nodes.values() if n.type == "concept"]
        
        # Simple co-occurrence based relationships
        # In production: use better semantic similarity
        for i, concept1 in enumerate(concepts):
            for concept2 in concepts[i+1:]:
                # Check if they appear in same documents
                docs1 = set(r.to_id for r in self.relationships 
                           if r.from_id == concept1.id and r.rel_type == "extracted_from")
                docs2 = set(r.to_id for r in self.relationships 
                           if r.from_id == concept2.id and r.rel_type == "extracted_from")
                
                overlap = len(docs1 & docs2)
                if overlap > 0:
                    strength = min(1.0, overlap / 3.0)  # Normalize
                    rel = Relationship(
                        from_id=concept1.id,
                        to_id=concept2.id,
                        rel_type="related_to",
                        strength=strength,
                        bidirectional=True
                    )
                    self.add_relationship(rel)
    
    @tracer.start_as_current_span("generate_embeddings")
    def generate_embeddings(self):
        """Generate embeddings for concept nodes"""
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer('all-MiniLM-L6-v2')
            
            concepts = [n for n in self.nodes.values() if n.type == "concept"]
            print(f"Generating embeddings for {len(concepts)} concepts...")
            
            for concept in concepts:
                text = concept.data.get('name', '') + ' ' + concept.data.get('definition', '')
                embedding = model.encode(text).tolist()
                concept.embedding = embedding
            
            print("Embeddings generated successfully")
        except Exception as e:
            print(f"Embedding generation failed (optional): {e}")
    
    def export_to_json(self):
        """Export graph to JSON files"""
        output_dir = self.research_dir.parent / "knowledge_graph_output"
        output_dir.mkdir(exist_ok=True)
        
        # Export nodes
        nodes_data = {node_id: asdict(node) for node_id, node in self.nodes.items()}
        with open(output_dir / "nodes.json", 'w') as f:
            json.dump(nodes_data, f, indent=2)
        
        # Export relationships
        rels_data = [asdict(rel) for rel in self.relationships]
        with open(output_dir / "relationships.json", 'w') as f:
            json.dump(rels_data, f, indent=2)
        
        # Export summary stats
        stats = {
            "total_nodes": len(self.nodes),
            "total_relationships": len(self.relationships),
            "node_types": {
                "concept": len([n for n in self.nodes.values() if n.type == "concept"]),
                "document": len([n for n in self.nodes.values() if n.type == "document"]),
                "anchor": len([n for n in self.nodes.values() if n.type == "anchor"]),
            },
            "relationship_types": {},
            "generated": datetime.now().isoformat(),
        }
        
        # Count relationship types
        for rel in self.relationships:
            stats["relationship_types"][rel.rel_type] = \
                stats["relationship_types"].get(rel.rel_type, 0) + 1
        
        with open(output_dir / "stats.json", 'w') as f:
            json.dump(stats, f, indent=2)
        
        print(f"\nExported to: {output_dir}")
        print(f"  - nodes.json ({len(nodes_data)} nodes)")
        print(f"  - relationships.json ({len(rels_data)} relationships)")
        print(f"  - stats.json")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        research_dir = sys.argv[1]
    else:
        research_dir = os.path.expanduser("~/workspace/hughmk1/research_materials")
    
    if not os.path.exists(research_dir):
        print(f"Error: Directory not found: {research_dir}")
        sys.exit(1)
    
    builder = KnowledgeGraphBuilder(research_dir)
    builder.process_all_documents()
