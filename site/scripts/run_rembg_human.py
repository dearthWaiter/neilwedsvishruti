from rembg import remove, new_session
import os
os.makedirs("pipeline_out/rembg_h", exist_ok=True)
session = new_session("u2net_human_seg")
for id in ["s1", "s3", "s4", "s5", "s6", "s7"]:
    with open(f"../assets/{id}_master.png", "rb") as f:
        data = f.read()
    out = remove(data, session=session, post_process_mask=True)
    with open(f"pipeline_out/rembg_h/{id}_r.png", "wb") as f:
        f.write(out)
    print(f"{id} done", flush=True)
print("ALL DONE", flush=True)
