encoding = "utf-8"
error = "strict"


def main(exp_file, encoding, errors):
    line = exp_file.readline()
    if line:
        print_line(line, encoding, errors)
        return main(exp_file, encoding, errors)


def print_line(line, encoding, errors):
    next_lang = line.strip()
    raw_bytes = next_lang.encode(encoding, errors=errors)
    cooked_string = raw_bytes.decode(encoding, errors=errors)

    print(raw_bytes, "<====>", cooked_string)


exp_file = open("exp.txt", encoding="utf-8")

main(exp_file, encoding, error)
