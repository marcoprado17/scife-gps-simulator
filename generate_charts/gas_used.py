import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import json

def sort_key(elem):
    return elem["idx"]

with open('../persistent_reports/1539637055.json') as f:
    report = json.load(f)

    x = []
    y = []

    filterd_data = report["data"]
    filterd_data.sort(key=sort_key)
    filterd_data = [elem for elem in filterd_data if elem["status"] == "OK"]

    for tx in report["data"]:
        x.append(tx["idx"])
        y.append(tx["result"]["gasUsed"])

    print(x)
    print(y)

    fig, ax = plt.subplots()
    ax.plot(x, y)
    ax.set_ylim(0, 200000)

    ax.set(xlabel='Índice da transação', ylabel='Gas utilizado (unidade de gás)',
        title='Gás utilizado para cada transação')
    ax.grid()

    fig.savefig("gas_used.png")
    plt.show()
