
import os
import json
import requests
import glob

# Configuration
SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa"
JSON_DIR = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\frontend 2.6.2\json files"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def upload_json_files():
    # Find all json files
    json_files = glob.glob(os.path.join(JSON_DIR, "**", "*.json"), recursive=True)
    print(f"Found {len(json_files)} JSON files.")

    stats = {"files_processed": 0, "tests_upserted": 0, "questions_upserted": 0, "errors": 0}

    for file_path in json_files:
        print(f"--- Processing: {os.path.basename(file_path)} ---")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 1. Prepare Test Data
            test_id = data.get('id')
            if not test_id:
                print(f"Skipping {file_path}: No test ID found.")
                continue

            test_payload = {
                "id": test_id,
                "title": data.get('title'),
                "institute": data.get('institute'),
                "program_id": data.get('program_id'),
                "program_name": data.get('program_name'),
                "launch_year": data.get('launch_year'),
                "series": data.get('series'),
                "level": data.get('level'),
                "paper_type": data.get('paperType'),
                "default_minutes": data.get('defaultMinutes', 60),
                "source_mode": data.get('sourceMode'),
                "question_count": len(data.get('questions', []))
            }

            # Upsert Test
            res = requests.post(f"{SUPABASE_URL}/rest/v1/tests", headers=headers, json=test_payload)
            if res.status_code not in [200, 201]:
                print(f"Error uploading test {test_id}: {res.text}")
                # Continue anyway, maybe the questions can still be uploaded
            else:
                stats["tests_upserted"] += 1
            
            # 2. Prepare Questions Data
            questions = data.get('questions', [])
            if not questions:
                print(f"No questions found in {test_id}")
                stats["files_processed"] += 1
                continue

            q_payloads = []
            for q in questions:
                exam_info = q.get('exam_info', {})
                
                # Mapping fields
                q_data = {
                    "id": q.get('id'),
                    "test_id": test_id,
                    "question_number": q.get('questionNumber'),
                    "question_text": q.get('questionText'),
                    "statement_lines": q.get('statementLines'),
                    "options": q.get('options'),
                    "correct_answer": q.get('correctAnswer'),
                    "explanation_markdown": q.get('explanationMarkdown'),
                    "source_attribution_label": q.get('source_attribution_label'),
                    "subject": q.get('subject'),
                    "section_group": q.get('sectionGroup'),
                    "micro_topic": q.get('microTopic'),
                    "is_pyq": exam_info.get('isPyq', False),
                    "is_ncert": exam_info.get('is_ncert', False),
                    "is_upsc_cse": exam_info.get('is_upsc_cse', False),
                    "is_allied": exam_info.get('is_allied', False),
                    "is_others": exam_info.get('is_others', False),
                    "exam": exam_info.get('exam'),
                    "exam_group": exam_info.get('group'),
                    "exam_year": exam_info.get('year'),
                    "exam_category": exam_info.get('exam_category'),
                    "specific_exam": exam_info.get('specific_exam'),
                    "exam_stage": exam_info.get('stage'),
                    "exam_paper": exam_info.get('paper'),
                    "source": exam_info # Store the whole thing as fallback
                }
                q_payloads.append(q_data)

            # Bulk Upsert Questions
            BATCH_SIZE = 50
            for i in range(0, len(q_payloads), BATCH_SIZE):
                batch = q_payloads[i:i + BATCH_SIZE]
                res = requests.post(f"{SUPABASE_URL}/rest/v1/questions", headers=headers, json=batch)
                if res.status_code not in [200, 201]:
                    print(f"Error uploading batch {i//BATCH_SIZE + 1} for {test_id}: {res.text}")
                    stats["errors"] += 1
                else:
                    stats["questions_upserted"] += len(batch)
            
            stats["files_processed"] += 1
            print(f"Completed {test_id}: {len(q_payloads)} questions.")

        except Exception as e:
            print(f"Failed to process {file_path}: {str(e)}")
            stats["errors"] += 1

    print("\n" + "="*30)
    print("UPLOAD SUMMARY")
    print(f"Files Processed: {stats['files_processed']}")
    print(f"Tests Upserted: {stats['tests_upserted']}")
    print(f"Questions Upserted: {stats['questions_upserted']}")
    print(f"Errors Encountered: {stats['errors']}")
    print("="*30)

if __name__ == "__main__":
    upload_json_files()
