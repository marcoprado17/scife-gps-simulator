import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import json

GAS_PRICE = 10000000000 # Wei
WEI_TO_ETH = 1/1000000000000000000
ETH_TO_DOLLAR = 220

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
        y.append(tx["result"]["gasUsed"]*GAS_PRICE*WEI_TO_ETH*ETH_TO_DOLLAR)

    print(x)
    print(y)

    fig, ax = plt.subplots()
    ax.plot(x, y)
    ax.set_ylim(0, 1)

    ax.set(xlabel='Índice da transação', ylabel='Preço ($)',
        title='Preço de cada transação')
    ax.grid()

    fig.savefig("price.png")
    plt.show()
