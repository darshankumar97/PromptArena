import sqlite3

c = sqlite3.connect("promptarena.db")
print("TABLE:", c.execute("select sql from sqlite_master where type='table' and name='generation_jobs'").fetchone())
print("INDEXES:", c.execute("select sql from sqlite_master where type='index' and tbl_name='generation_jobs'").fetchall())
print("JOBS:", c.execute("select * from generation_jobs").fetchall())
print("SUBS:", c.execute("select id, round_id, user_id, status from submissions").fetchall())
