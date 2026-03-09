diff --git a/server.py b/server.py
index 28e8a5b..901d5ab 100644
--- a/server.py
+++ b/server.py
@@ -78,9 +78,7 @@
     name="GUI-tools",
     host="127.0.0.1",
     port=5000,
-    # Add this to make the server more resilient
-    timeout=60  # Increase timeout to 60 seconds
 )
 
 @mcp.tool()
