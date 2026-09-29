import sys
from rembg import remove, new_session
from PIL import Image
import io, os

os.makedirs("pipeline_out/rembg", exist_ok=True)
session = new_session("u2net")
ids = ["s1", "s3", "s4", "s5", "s6", "s7"]
for id in ids:
    inp = f"../assets/{id}_master.png"
    with open(inp, "rb") as f:
        data = f.read()
    out = remove(data, session=session, post_process_mask=True)
    with open(f"pipeline_out/rembg/{id}_r.png", "wb") as f:
        f.write(out)
    print(f"{id} done", flush=True)
print("ALL DONE", flush=True)
