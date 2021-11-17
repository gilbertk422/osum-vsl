#!/usr/bin/env python3

import asyncio
import websockets
import sys
import json

async def hello(uri):
    async with websockets.connect(uri) as websocket:

        proc = await asyncio.create_subprocess_exec(
                       'ffmpeg', '-nostdin', '-loglevel', 'quiet', '-i', sys.argv[1],
                       '-ar', '16000', '-ac', '1', '-f', 's16le', '-',
                       stdout=asyncio.subprocess.PIPE)

        words = []
        while True:
            data = await proc.stdout.read(32768)

            if len(data) == 0:
                break

            await websocket.send(data)
            res = json.loads( await websocket.recv() )

            if ("result" in res):
#                 print( res["result"] )
                words = words + res["result"]

        await websocket.send('{"eof" : 1}')

        res = json.loads( await websocket.recv() )
        words = words + res["result"]
        print ( json.dumps(words) )

#         print (await websocket.recv())
        await proc.wait()

asyncio.get_event_loop().run_until_complete( hello(sys.argv[2]))
asyncio.get_event_loop().close()
