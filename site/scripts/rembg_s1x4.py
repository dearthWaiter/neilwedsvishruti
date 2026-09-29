from rembg import remove, new_session
session = new_session("u2net_human_seg")
with open("tools/up/s1_master_x4.png","rb") as f: data=f.read()
out = remove(data, session=session, post_process_mask=True)
with open("pipeline_out/rembg_h/s1_x4_r.png","wb") as f: f.write(out)
print("done", flush=True)
