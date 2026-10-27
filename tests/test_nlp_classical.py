from veritas_clin.nlp_classical import Word2Vec, normalize, tokenize


def test_tokenization_normalizes_case():
    assert tokenize("Metformin, twice daily!") == ["metformin", "twice", "daily"]


def test_word2vec_learns_neighbors():
    model = Word2Vec(vector_size=4, epochs=1, min_count=1)
    model.train([["metformin", "diabetes", "metformin", "diabetes"]])
    assert "diabetes" in dict(model.most_similar("metformin"))


def test_normalize_for_lookup():
    assert normalize(" Metformin ") == "metformin"
