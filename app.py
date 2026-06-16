import re
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_feed_content(html_content):
    if not html_content:
        return []
    
    # Split content by <h3>Type</h3>
    parts = re.split(r'<h3>(.*?)</h3>', html_content)
    updates = []
    
    if len(parts) <= 1:
        # No <h3> tags found, return the whole content as "General" type
        cleaned_text = html_content.strip()
        if cleaned_text:
            plain_text = re.sub(r'<[^<]+?>', '', cleaned_text)
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            updates.append({
                "type": "General",
                "html": cleaned_text,
                "text": plain_text
            })
        return updates

    # parts[0] is everything before the first <h3> (usually empty)
    for i in range(1, len(parts), 2):
        if i + 1 < len(parts):
            category = parts[i].strip()
            content_html = parts[i+1].strip()
            # Clean up leading/trailing whitespace or breaks
            content_html = re.sub(r'^(?:<br\s*/?>|\s)+', '', content_html)
            content_html = re.sub(r'(?:<br\s*/?>|\s)+$', '', content_html)
            
            # Extract plain text for tweet summaries
            plain_text = re.sub(r'<[^<]+?>', '', content_html)
            # Replace multiple spaces/newlines
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            
            updates.append({
                "type": category,
                "html": content_html,
                "text": plain_text
            })
            
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse Atom Feed XML
        root = ET.fromstring(response.content)
        
        # Atom Namespace mapping
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            date_title_elem = entry.find('atom:title', ns)
            date_title = date_title_elem.text if date_title_elem is not None else 'Unknown Date'
            
            id_elem = entry.find('atom:id', ns)
            entry_id = id_elem.text if id_elem is not None else 'unknown_id'
            
            updated_elem = entry.find('atom:updated', ns)
            updated = updated_elem.text if updated_elem is not None else ''
            
            link_elem = entry.find("atom:link[@rel='alternate']", ns)
            if link_elem is None:
                link_elem = entry.find('atom:link', ns)
            link = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            content_elem = entry.find('atom:content', ns)
            html_content = content_elem.text if content_elem is not None else ''
            
            # Parse the individual updates in this entry
            split_updates = parse_feed_content(html_content)
            
            for index, update in enumerate(split_updates):
                entries.append({
                    "id": f"{entry_id}_{index}",
                    "date": date_title,
                    "updated": updated,
                    "link": link,
                    "type": update["type"],
                    "html": update["html"],
                    "text": update["text"]
                })
                
        return jsonify({"success": True, "entries": entries})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
