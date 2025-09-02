#!/usr/bin/env python3
"""
Simple HTTP server for testing the admin panel
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

def main():
    # Change to the admin directory
    admin_dir = Path(__file__).parent
    os.chdir(admin_dir)
    
    # Set up the server
    PORT = 8080
    
    class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Add CORS headers for development
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            super().end_headers()
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"🚀 Server started at http://localhost:{PORT}")
        print(f"📁 Serving files from: {admin_dir}")
        print(f"🌐 Open your browser and go to: http://localhost:{PORT}")
        print(f"📄 Test page: http://localhost:{PORT}/test.html")
        print(f"🏠 Main page: http://localhost:{PORT}/index.html")
        print("-" * 50)
        print("Press Ctrl+C to stop the server")
        
        # Try to open the browser automatically
        try:
            webbrowser.open(f'http://localhost:{PORT}/test.html')
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    main()
