import os
import re

def fix_file_paths(file_path):
    """Fix relative paths in HTML files"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Fix CSS paths: ../css/ -> /css/
        content = re.sub(r'href="\.\./css/', 'href="/css/', content)
        
        # Fix image paths: ../img/ -> /img/
        content = re.sub(r'src="\.\./img/', 'src="/img/', content)
        
        # Fix JavaScript paths: ../js/ -> /js/
        content = re.sub(r'src="\.\./js/', 'src="/js/', content)
        
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    # Directories to process
    directories = [
        'Platform/pages',
        'Platform/admin'
    ]
    
    total_files = 0
    processed_files = 0
    
    for directory in directories:
        if os.path.exists(directory):
            print(f"\nProcessing directory: {directory}")
            for filename in os.listdir(directory):
                if filename.endswith('.html'):
                    file_path = os.path.join(directory, filename)
                    total_files += 1
                    print(f"Processing: {filename}")
                    if fix_file_paths(file_path):
                        processed_files += 1
                        print(f"  ✓ Fixed paths in {filename}")
                    else:
                        print(f"  ✗ Failed to process {filename}")
        else:
            print(f"Directory not found: {directory}")
    
    print(f"\n=== Summary ===")
    print(f"Total HTML files found: {total_files}")
    print(f"Successfully processed: {processed_files}")
    print(f"Failed: {total_files - processed_files}")
    
    if processed_files > 0:
        print(f"\nAll relative paths have been converted to absolute paths:")
        print(f"- ../css/ → /css/")
        print(f"- ../img/ → /img/")
        print(f"- ../js/ → /js/")

if __name__ == "__main__":
    main()
