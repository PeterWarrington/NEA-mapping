# Graph theory research
This document will look at how graph theory can be utilised with details on how this can be implemented, making notes from sources.

# Notes
- Graph theory models paths in terms of pairs between nodes (also called vertices) which are connected by links (also called edges) [1]
- Pathfinding is largely based on Dijkstra's algorithm, and the use of weighted graphs [2]
- Weighting refers to the "cost" it takes to traverse a link, e.g. how long it takes, it is a number [2,3]
- For Dijkstra's algorithm:
    "This algorithm begins with a start node and an "open set" of candidate nodes. At each step, the node in the open set with the lowest distance from the start is examined. The node is marked "closed", and all nodes adjacent to it are added to the open set if they have not already been examined. This process repeats until a path to the destination has been found. Since the lowest distance nodes are examined first, the first time the destination is found, the path to it will be the shortest path."

# References
[1] https://en.wikipedia.org/wiki/Graph_theory

[2] https://en.wikipedia.org/wiki/Pathfinding

[3] https://en.wikipedia.org/wiki/Glossary_of_graph_theory#Weighted_graphs_and_networks
