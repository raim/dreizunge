library(ape)

## full glottolot tree
flt <- ape::read.tree("tree/tree_glottolog_newick.txt")

## TODO: load languages and filter glottolog tree, to get at least
## all branches right
##plot(flt, dir='downwards')

## reduced tree
lt <- ape::read.tree("tree/langs_newick.txt")

svg(file="tree/langs_newick.svg")
plot(lt, dir='downwards')
nodelabels(
  text = lt$node.label,
  frame = "none",
  cex = 0.8
)
dev.off()

